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
    mkdirp = require('mkdirp'),
    watchr = require('watchr');

function log() {
    var args = _.toArray(arguments);
    args.unshift('[exif-renamer]');
    console.log.apply(global, args);
}

Handlebars.registerHelper('date', function(format) {
    format = (arguments.length === 1) ? 'yyyy-mm-dd' : format;
    return dateformat(this.exif.DateTimeOriginal, format);
});

var exifRenamer = {

    generate_name: function(fileinfo, exifdata, template) {
        // create a combined metadata object
        var metadata = _.assign(
            fileinfo,
            exifdata,
            {
                'date': dateformat(exifdata.exif.DateTimeOriginal, 'yyyy-mm-dd'),
                'time': dateformat(exifdata.exif.DateTimeOriginal, 'HH:MM:ss'),
                'file': fileinfo.basename,
                'dir':  path.basename(fileinfo.dirname),
                'ext':  fileinfo.extname.toLowerCase().substr(1),
                'EXT':  fileinfo.extname.toUpperCase().substr(1)
            }
        );

        // pre-process the template
        template = template.replace('/', path.sep);
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
            extname: path.extname(filepath)
        };
    },

    process: function(filepath, template, callback) {
        var orig = this.get_file_info(filepath);

        this.get_exif(orig.path, function(err, exifdata) {
            var fn, name, info, result;
            if (!err) {
                fn = (_.isFunction(template)) ? template : this.generate_name.bind(this);
                name = fn(orig, exifdata, template);
                info = this.get_file_info(path.join(orig.dirname, name));
                result = {
                    template: template,
                    original: orig,
                    processed: info
                };
            }
            callback(err, result);
        }.bind(this));
    },

    rename: function(filepath, template, callback) {
        this.process(filepath, template, function(err, result) {
            if (!err) {
                mkdirp.sync(result.processed.dirname);
                fs.renameSync(result.original.path, result.processed.path);
            }
            callback(err, result);
        });
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
                    log(err ? err : 'watching: ' + this.path);
                },
                change: function(type, filepath, curr) {
                    //log('>>>> ' + type, filepath);

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
    log: log,
    exif: Q.nbind(exifRenamer.get_exif, exifRenamer),
    process: Q.nbind(exifRenamer.process, exifRenamer),
    rename: Q.nbind(exifRenamer.rename, exifRenamer),
    watch: exifRenamer.watch
};
