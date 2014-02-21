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
        date_format: 'yyyy-mm-dd',
        time_format: 'HH:MM:ss',
        path_separator: '/',
        valid_extensions: ['jpg', 'jpeg'],
        dryrun: false,
        fallback_ctime: true
    };

Handlebars.registerHelper('date', function(format) {
    format = (arguments.length === 1) ? exifRenamer.config.date_format : format;
    return dateformat(this.datetime, format);
});

var exifRenamer = {

    config: _.assign({}, defaults),

    generate_name: function(fileinfo, exifdata, template) {
        var cfg = this.config,
            metadata,
            datetime = exifdata.exif && exifdata.exif.DateTimeOriginal;

        if (!datetime && (this.config.fallback_ctime === true && fileinfo.stat.ctime)) {
            datetime = fileinfo.stat.ctime;
        }

        // create a combined metadata object
        metadata = _.assign(
            {
                'datetime': datetime,
                'date': dateformat(datetime, cfg.date_format),
                'time': dateformat(datetime, cfg.time_format),
                'file': fileinfo.basename,
                'dir':  path.basename(fileinfo.dirname),
                'ext':  fileinfo.extname.toLowerCase().substr(1),
                'EXT':  fileinfo.extname.toUpperCase().substr(1)
            },
            fileinfo,
            exifdata
        );

        // pre-process the template
        template = template.replace(cfg.path_separator, path.sep);
        return Handlebars.compile(template)(metadata);
    },

    get_exif: function(filepath, callback) {
        new ExifImage({image: filepath}, callback);
    },

    get_file_info: function(filepath) {
        filepath = path.normalize(path.resolve(filepath));
        return {
            path: filepath,
            basename: path.basename(filepath),
            dirname: path.dirname(filepath),
            extname: path.extname(filepath),
            stat: fs.existsSync(filepath) ? fs.lstatSync(filepath) : {}
        };
    },

    process: function(filepath, template, callback, ignore_errors) {
        var orig = this.get_file_info(filepath),
            ext = orig.extname.substr(1).toLowerCase();

        if (this.config.valid_extensions.indexOf(ext) < 0) {
            return callback('Unsupported file extension: ' + orig.path);
        }

        this.get_exif(orig.path, function(err, exifdata) {
            var fn, name, info, result;
            exifdata = exifdata || {};

            if (!err || (this.config.fallback_ctime === true && orig.stat.ctime)) {
                fn = (_.isFunction(template)) ? template : this.generate_name.bind(this);
                name = fn(orig, exifdata, template);
                info = this.get_file_info(path.join(orig.dirname, name));
                result = {
                    template: template,
                    original: orig,
                    processed: info
                };
                callback(null, result);
            }
            else if (!ignore_errors) {
                return callback('No EXIF data found for ' + orig.path);
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
            if (!err) {
                mkdirp.sync(result.processed.dirname);
                if (!this.config.dryrun) {
                    fs.renameSync(result.original.path, result.processed.path);
                }
            }
            callback(err, result);
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
                                callback(err, result);
                            }
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
