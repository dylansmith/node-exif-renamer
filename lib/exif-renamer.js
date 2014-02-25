/*
 * exif-renamer
 * https://github.com/dylansmith/node-exif-renamer
 *
 * Copyright (c) 2014 Dylan Smith
 * Licensed under the MIT license.
 */

'use strict';

var _ = require('lodash'),
    Q = require('q'),
    Handlebars = require('handlebars'),
    dateformat = require('dateformat'),
    ExifImage = require('exif').ExifImage,
    path = require('path'),
    fs = require('fs'),
    glob = require('glob'),
    mkdirp = require('mkdirp'),
    watchr = require('watchr'),
    // default configuration
    defaults = {
        dryrun: false,                      // simulate processing without modifying the filesystem
        fallback_ctime: true,               // fallback to filesystem ctime if no EXIF DateTimeOriginal
        overwrite: false,                   // overwrite existing files?
        path_separator: '/',                // the character used to separate paths in templates
        formats: {
            datetime: 'yyyymmdd-HHMMss',    // default formatting for {{datetime}}
            date: 'yyyymmdd',               // default formatting for {{date}}
            time: 'HHMMss'                  // default formatting for {{time}}
        },
        valid_extensions: ['jpg', 'jpeg']   // supported file extensions for processing
    },
    exifRenamer;

Handlebars.registerHelper('datetime', function(format) {
    format = (arguments.length === 1)
        ? exifRenamer.config.formats.datetime
        : format;
    return dateformat(this.datetime, format);
});

exifRenamer = {

    config: _.assign({}, defaults),

    generate_name: function(srcinfo, exifdata, template) {
        var cfg = this.config,
            metadata,
            datetime = exifdata.exif && exifdata.exif.DateTimeOriginal;

        if (!datetime && (this.config.fallback_ctime === true && srcinfo.stat.ctime)) {
            datetime = srcinfo.stat.ctime;
        }

        // create a combined metadata object
        metadata = _.assign(
            {
                'datetime': datetime,
                'date': dateformat(datetime, cfg.formats.date),
                'time': dateformat(datetime, cfg.formats.time)
            },
            srcinfo,
            exifdata
        );

        if (_.isFunction(template)) {
            return template(metadata);
        }
        else {
            // correct path separators
            template = template.replace(cfg.path_separator, '/');
            return Handlebars.compile(template)(metadata);
        }
    },

    get_exif: function(filepath, callback) {
        new ExifImage({image: filepath}, callback);
    },

    get_file_info: function(filepath) {
        filepath = path.normalize(path.resolve(filepath));
        return {
            path: filepath,
            file: path.basename(filepath),
            name: path.basename(filepath, path.extname(filepath)),
            dir: path.dirname(filepath),
            dirname: path.basename(path.dirname(filepath)),
            ext: path.extname(filepath).substr(1).toLowerCase(),
            EXT: path.extname(filepath).substr(1).toUpperCase(),
            stat: fs.existsSync(filepath) ? fs.lstatSync(filepath) : null
        };
    },

    process: function(filepath, template, callback, ignore_errors) {
        var src = this.get_file_info(filepath);

        if (this.config.valid_extensions.indexOf(src.ext) < 0) {
            return callback('unsupported file extension: ' + src.path);
        }

        this.get_exif(src.path, function(err, exifdata) {
            var target;
            exifdata = exifdata || {};

            if (!err || (this.config.fallback_ctime === true && src.stat.ctime)) {
                target = this.generate_name(src, exifdata, template);
                target = this.get_file_info(target);
                callback(null, {
                    template: template,
                    original: src,
                    processed: target
                });
            }
            else if (!ignore_errors) {
                callback('no EXIF data found for ' + src.path);
            }
        }.bind(this));
    },

    rename_dir: function(dirpath, template, callback, recursive) {
        var p = path.resolve(dirpath);
        recursive = !!recursive;

        if (!fs.existsSync(dirpath) || !fs.lstatSync(p).isDirectory()) {
            return callback(dirpath + ' is not a valid directory');
        }

        glob.sync('*', {cwd: p}).forEach(function(file) {
            var f, stat;
            f = path.join(p, file);
            stat = fs.lstatSync(f);

            if (stat.isFile()) {
                this.rename(f, template, callback, true);
            }
            if (stat.isDirectory() && recursive === true) {
                this.rename_dir(f, template, callback, recursive);
            }
        }.bind(this));
    },

    rename: function(filepath, template, callback) {
        this.process(filepath, template, function(err, result) {
            if (err) return callback(err);
            // prevent overwrites
            if (result.processed.stat && !this.config.overwrite) {
                err = 'invalid rename target: ';
                if (result.processed.stat.isDirectory()) {
                    err += result.processed.path + ' is a directory';
                }
                else if (result.processed.stat.isFile()) {
                    err += result.processed.path + ' already exists';
                }
            }
            else if (!this.config.dryrun) {
                mkdirp.sync(result.processed.dir);
                fs.renameSync(result.original.path, result.processed.path);
            }
            return callback(err, result);
        }.bind(this));
    },

    watch: function(dirpath, template, callback) {
        var scope = this,
            sourcePaths = {},
            targetPaths = {};

        watchr.watch({
            path: dirpath,
            ignoreCommonPatterns: true,
            listeners: {
                watching: function(err) {
                    console.log('[exif-renamer] ' + ((err) ? err : 'watching: ' + this.path));
                },
                change: function(type, filepath, curr) {
                    // ignore directories
                    if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
                        return;
                    }

                    // if created and a known target path, flush
                    if (type === 'create' && filepath in targetPaths) {
                        delete targetPaths[filepath];
                        return;
                    }

                    // if deleted and a known source path, flush
                    if (type === 'delete' && filepath in sourcePaths) {
                        delete sourcePaths[filepath];
                        return;
                    }

                    // otherwise process if created and untracked
                    if (type === 'create' || type === 'update') {
                        // ignore future changes to the source
                        sourcePaths[filepath] = curr;
                        scope.rename(filepath, template, function(err, result) {
                            if (!err) {
                                // ignore future changes to the target
                                targetPaths[result.processed.path] = curr;
                            }
                            callback(err, result);
                        });
                    }
                }
            }
        });
    }

};

module.exports = {
    config:     exifRenamer.config,
    exif:       Q.nbind(exifRenamer.get_exif, exifRenamer),
    process:    Q.nbind(exifRenamer.process, exifRenamer),
    rename:     Q.nbind(exifRenamer.rename, exifRenamer),
    rename_dir: Q.nbind(exifRenamer.rename_dir, exifRenamer),
    watch:      Q.nbind(exifRenamer.watch, exifRenamer)
};
