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
    dateformat = require('dateformat'),
    ExifImage = require('exif').ExifImage,
    objectPath = require('object-path'),
    path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    watchr = require('watchr');

function log() {
    var args = _.toArray(arguments);
    args.unshift('[exif-renamer]');
    console.log.apply(global, args);
}

var exifRenamer = {

    generate_name: function(filepath, data, template) {
        var name = template,
            found,
            val,
            refs = {},
            re = /\%\{([a-z\.]+)\}/ig,
            wildcards = {
                 '/':     path.sep
                ,'%date': function() { return dateformat(data.exif.DateTimeOriginal, 'yyyy-mm-dd'); }
                ,'%file': function() { return path.basename(filepath); }
                ,'%dir':  function() { return path.basename(path.dirname(filepath)); }
                ,'%ext':  function() { return path.extname(filepath).substr(1).toLowerCase(); }
                ,'%EXT':  function() { return path.extname(filepath).substr(1).toUpperCase(); }
                ,'%yyyy': function() { return dateformat(data.exif.DateTimeOriginal, 'yyyy'); }
                ,'%yy':   function() { return dateformat(data.exif.DateTimeOriginal, 'yy'); }
                ,'%mm':   function() { return dateformat(data.exif.DateTimeOriginal, 'mm'); }
                ,'%dd':   function() { return dateformat(data.exif.DateTimeOriginal, 'dd'); }
            };

        // process EXIF references
        while ((found = re.exec(name)) !== null) {
            val = objectPath.get(data, found[1]);
            if (val) {
                refs[found[0]] = val;
            }
        }

        // process all placeholders
        _.forEach(_.assign({}, wildcards, refs), function(v, k) {
            name = name.replace(k, (_.isFunction(v) ? v() : v).toString());
        });

        return name;
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

        Q.nfcall(this.get_exif, orig.path)
            .catch(callback)
            .done(function(metadata) {
                var fn, name, info;

                fn = (_.isFunction(template)) ? template : this.generate_name;
                name = fn(orig.path, metadata, template);
                info = this.get_file_info(path.join(orig.dirname, name));

                callback(null, {
                    template: template,
                    original: orig,
                    processed: info
                });

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
