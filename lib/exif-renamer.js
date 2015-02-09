/*
 * exif-renamer
 * https://github.com/dylansmith/node-exif-renamer
 *
 * Copyright (c) 2014 Dylan Smith
 * Licensed under the MIT license.
 */

'use strict';

var exifRenamer,
    _ = require('lodash'),
    Handlebars = require('handlebars'),
    dateformat = require('dateformat'),
    path = require('path'),
    fs = require('fs'),
    glob = require('glob'),
    mkdirp = require('mkdirp'),
    watchr = require('watchr'),
    Q = require('q'),

    // default configuration
    defaults = {
        dryrun: false,                          // simulate processing without modifying the filesystem
        fallback_ctime: true,                   // fallback to filesystem ctime if no EXIF DateTimeOriginal
        overwrite: false,                       // overwrite existing files?
        require_exif: false,                    // fail if EXIF data is not found?
        path_separator: '/',                    // the character used to separate paths in templates
        formats: {
            datetime: 'yyyymmdd-HHMMss',        // default formatting for {{datetime}}
            date: 'yyyymmdd',                   // default formatting for {{date}}
            time: 'HHMMss'                      // default formatting for {{time}}
        },
        valid_extensions: [                      // supported file extensions for processing
            'jpg','jpeg','tif','tiff'
        ]
    };

Handlebars.registerHelper('datetime', function(format) {
    format = (arguments.length === 1)
        ? exifRenamer.config.formats.datetime
        : format;
    return dateformat(this.datetime, format);
});

exifRenamer = {

    config: null,

    /**
     * Generates a standardised Error object
     * @param  {Error|String} errOrMessage
     * @param  {Object} result
     * @return {Error}
     */
    error: function(errOrMessage, result) {
        var err = (errOrMessage instanceof Error) ? errOrMessage : new Error(errOrMessage);
        result = result || {};
        result.error = err;
        result.status = 'error';
        err.result = result;
        return err;
    },

    /**
     * @method #generate_name(metadata, template)
     * @arg {Object} metadata
     * @arg {(String|Function)}
     * @returns {String}
     */
    generate_name: function(metadata, template) {
        var output, parts, targetPath, targetFile;

        if (_.isFunction(template)) {
            output = template(metadata);
            if (!output) {
                throw this.error('custom templating functions must return a value', metadata);
            }
        }
        else {
            // correct path separators
            template = template.replace(this.config.path_separator, '/');

            // process relative path indicators
            parts = template.split(':');
            targetFile = parts.pop();
            targetPath = parts.pop() || '.';
            if (targetPath[0] === '.') {
                targetPath = path.join(metadata.dir, targetPath);
            }

            targetPath = path.resolve(Handlebars.compile(targetPath)(metadata));
            template = [targetPath, targetFile].join('/');

            output = Handlebars.compile(template)(metadata);
        }
        return output;
    },

    /**
     * @method #get_exif(filepath, callback)
     * @arg {String} filepath
     * @arg {Function} callback
     */
    get_exif: function(filepath, callback) {
        var exifParser = require('exif-parser'),
            buf, parser, result;
        try {
            buf = fs.readFileSync(filepath);
            parser = exifParser.create(buf);
            result = parser.parse();
            result = {
                exif: _.isEmpty(result.tags) ? null : result.tags,
                gps: _.isEmpty(result.gps) ? null : result.gps
            };
            if (!result.exif) {
                callback(this.error('no EXIF data', result), result);
            }
            else {
                callback(false, result);
            }
        }
        catch (e) {
            callback(this.error(e));
        }
    },

    /**
     * @method #get_path_info(filepath)
     * @arg {String} filepath
     * @returns {Object}
     */
    get_path_info: function(filepath) {
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

    /**
     * @method #get_metadata(filepath, callback)
     * @arg {String} filepath
     * @arg {Function} callback
     */
    get_metadata: function(filepath, callback) {
        var src = this.get_path_info(filepath);

        // throw if the filetype is not supported
        if (!this.is_supported_file(filepath)) {
            return callback(this.error('unsupported file extension: ' + src.EXT, src));
        }

        this.get_exif(src.path, function(err, exif_data) {
            var metadata = _.assign(src, exif_data),
                datetime;

            if (err && this.config.require_exif === true) {
                return callback(this.error(err, metadata));
            }

            // determine datetime
            datetime = exif_data.exif && (exif_data.exif.DateTimeOriginal || exif_data.exif.CreateDate);
            if (datetime) {
                datetime = datetime * 1000;
            }
            else if (this.config.fallback_ctime === true && src.stat && src.stat.ctime) {
                datetime = src.stat.ctime;
            }
            else if (this.config.fallback_ctime === false) {
                return callback(this.error('can\'t resolve datetime: no EXIF datetimes and fallback_ctime=false', metadata));
            }

            // create a combined metadata object
            metadata = _.assign({
                'datetime': datetime,
                'date': dateformat(datetime, this.config.formats.date),
                'time': dateformat(datetime, this.config.formats.time),
                'here': path.resolve('.')
            }, metadata);

            callback(false, metadata);

        }.bind(this));
    },

    /**
     * @method #is_supported_file(filepath)
     * @arg {String} filepath
     * @returns {Boolean}
     */
    is_supported_file: function(filepath) {
        var src = this.get_path_info(filepath);
        return (this.config.valid_extensions.indexOf(src.ext) >= 0);
    },

    /**
     * @method #process(filepath, template, callback)
     * @arg {String} filepath
     * @arg {(String|Function)} template
     * @arg {Function} callback
     */
    process: function(filepath, template, callback) {
        var src = this.get_path_info(filepath),
            cfg = _.clone(this.config),
            result = {
                config: cfg,
                template: template,
                original: src,
                processed: null
            };

        // throw if not found
        if (!src.stat) {
            return callback(this.error('path not found', result));
        }

        // throw if a directory
        if (src.stat.isDirectory() === true) {
            return callback(this.error('path must be a file, not a directory', result));
        }

        // throw if not a file
        if (src.stat.isFile() === false) {
            return callback(this.error('path is not a valid file', result));
        }

        this.get_metadata(filepath, function(err, meta) {
            var target;

            if (err) {
                result.original = err.result;
                return callback(this.error(err, result));
            }

            try {
                target = this.generate_name(meta, template);
            } catch (e) {
                return callback(this.error(e, result));
            }

            result.original = meta;
            result.processed = this.get_path_info(target);
            callback(false, result);
        }.bind(this));
    },

    /**
     * @method #rename(filepath, template, callback)
     * @arg {String} filepath
     * @arg {(String|Function)} template
     * @arg {Function} callback
     */
    rename: function(filepath, template, callback) {
        this.process(filepath, template, function(err, result) {
            if (err) {
                return callback(err);
            }

            // prevent overwrites
            if (result.processed.stat) {
                if (result.processed.stat.isDirectory()) {
                    return callback(this.error('rename target "' + result.processed.path + '"" is a directory', result));
                }

                if (result.processed.stat.isFile() && !this.config.overwrite) {
                    return callback(this.error('rename target "' + result.processed.path + '"" already exists', result));
                }
            }

            if (!this.config.dryrun) {
                mkdirp.sync(result.processed.dir);
                fs.rename(result.original.path, result.processed.path, function() {
                    result.status = 'renamed';
                    callback(false, result);
                });
            }
            else {
                result.status = 'dryrun';
                callback(false, result);
            }

        }.bind(this));
    },

    /**
     * @method #rename_dir(dirpath, template, [recursive=true], callback)
     * @arg {String} filepath
     * @arg {(String|Function)} template
     * @arg {Boolean} [recursive=false]
     * @arg {Function} callback
     */
    rename_dir: function(dirpath, template, recursive, callback) {
        var p = path.resolve(dirpath),
            pattern = '*',
            promises = [];

        // recursive is optional
        if (arguments.length === 3) {
            callback = recursive;
            recursive = false;
        }

        if (!fs.existsSync(dirpath) || !fs.lstatSync(p).isDirectory()) {
            return callback(this.error(dirpath + ' is not a valid directory'));
        }

        pattern = (recursive === true) ? '**' : '*';

        glob.sync(pattern, {cwd: p}).forEach(function(file) {
            var f;
            f = path.join(p, file);
            if (fs.lstatSync(f).isFile()) {
                promises.push(Q.nfcall(this.rename.bind(this), f, template));
            }
        }.bind(this));

        Q.allSettled(promises).then(function(results) {
            results = _.map(results, function(r) {
                return (r.state === 'fulfilled') ? r.value : r.reason.result;
            });
            callback(false, results);
        });
    },

    /**
     * @method #watch(dirpath, template, callback)
     * @arg {String} filepath
     * @arg {(String|Function)} template
     * @arg {Function} callback
     */
    watch: function(dirpath, template, callback) {
        var scope = this,
            sourcePaths = {},
            targetPaths = {};

        watchr.watch({
            path: dirpath,
            ignoreCommonPatterns: true,
            listeners: {
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

module.exports = function(opts) {
    exifRenamer.config = _.assign({}, defaults, opts || {});
    exifRenamer.exif = exifRenamer.get_exif;
    return exifRenamer;
};
