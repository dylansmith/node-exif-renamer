/*global describe, it, beforeEach, after */
/*jshint expr:true, debug:true */

var should = require('should');
should;

var path = require('path'),
    fs = require('fs'),
    Q = require('q'),
    _ = require('lodash'),
    sinon = require('sinon'),
    dateformat = require('dateformat'),
    template = '{{datetime}}_{{file}}',
    imgPath = path.resolve(__dirname, '../demo/img'),
    imgExif = path.join(imgPath, 'exif.jpg'),
    imgNoExif = path.join(imgPath, 'no_exif.jpg'),
    notDir = path.join(imgPath, 'NOPE'),
    notFile = path.join(imgPath, 'NOPE.jpg'),
    unsupportedFile = path.join(imgPath, '../helpers.js'),
    helpers, testExif, exifRenamer;

helpers = {
    noop: function() {},

    cp: function(src, target, done) {
        if (!done) throw new Error('cp requires a callback');
        var reader = fs.createReadStream(src);
        reader.pipe(fs.createWriteStream(target));
        reader.on('end', function() {
            done();
        });
    },

    rmdir: function(dir) {
        var list = fs.readdirSync(dir);
        for(var i = 0; i < list.length; i++) {
            var filename = path.join(dir, list[i]);
            var stat = fs.statSync(filename);
            if (filename === "." || filename === "..") {
                // skip
            } else if (stat.isDirectory()) {
                this.rmdir(filename);
            } else {
                fs.unlinkSync(filename);
            }
        }
        fs.rmdirSync(dir);
    },

    getExif: function(path, callback) {
        require('../lib/exif-renamer.js')().exif(path, callback);
    }
};

describe('exif-renamer', function() {

    beforeEach(function(done) {
        exifRenamer = require('../lib/exif-renamer.js')();
        helpers.getExif(imgExif, function(err, data) {
            testExif = data;
            done();
        });
    });

    it('test files should exist', function(done) {
        fs.lstatSync(imgPath).isDirectory().should.be.true;
        fs.lstatSync(imgExif).isFile().should.be.true;
        fs.lstatSync(imgNoExif).isFile().should.be.true;
        fs.lstatSync(unsupportedFile).isFile().should.be.true;
        fs.existsSync(notDir).should.be.false;
        fs.existsSync(notFile).should.be.false;
        done();
    });

    it('imgExif should have EXIF data', function(done) {
        helpers.getExif(imgExif, function(err) {
            err.should.not.be.ok;
            done();
        });
    });

    it('imgNoExif should not have EXIF data', function(done) {
        helpers.getExif(imgNoExif, function(err) {
            err.should.be.an.instanceOf(Error);
            done();
        });
    });

    /**
     * #get_exif(filepath, callback)
     */
    describe('#exif', function() {

        it('should raise an error if filepath has no EXIF data', function(done) {
            exifRenamer.exif(imgNoExif, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should return EXIF data for the image at filepath', function(done) {
            exifRenamer.exif(imgExif, function(err, data) {
                err.should.be.false;
                data.should.have.property('exif');
                done();
            });
        });

    });

    /**
     * #process(filepath, template, [ignore_errors=false], callback)
     */
    describe('#process', function() {

        it('should raise an error if filepath is not a file', function(done) {
            exifRenamer.process(notFile, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should raise an error if filepath is a symlink', function(done) {
            var symlink = path.join(__dirname, 'exif_symlink');
            fs.symlinkSync(imgExif, symlink);
            fs.lstatSync(symlink).isSymbolicLink().should.be.true;
            exifRenamer.process(symlink, template, function(err) {
                err.should.be.an.instanceOf(Error);
                fs.unlinkSync(symlink);
                fs.existsSync(symlink).should.be.false;
                done();
            });
        });

        it('should raise an error if filepath is a directory', function(done) {
            exifRenamer.process(imgPath, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should raise an error if filepath is an unsupported type', function(done) {
            exifRenamer.process(unsupportedFile, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should raise an error if filepath does not have a valid extension', function(done) {
            exifRenamer.config.valid_extensions.should.not.containEql('js');
            exifRenamer.config.valid_extensions = ['js'];
            exifRenamer.process(imgExif, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should raise an error if filepath has no EXIF data when config.require_exif=true', function(done) {
            exifRenamer.config.require_exif = true;
            exifRenamer.process(imgNoExif, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should raise an error if filepath has no EXIF data when config.require_exif=false and config.fallback_ctime=false', function(done) {
            exifRenamer.config.require_exif = false;
            exifRenamer.config.fallback_ctime = false;
            exifRenamer.process(imgNoExif, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should not raise an error if filepath has no EXIF data when config.require_exif=false', function(done) {
            exifRenamer.config.require_exif = false;
            exifRenamer.process(imgNoExif, template, function(err) {
                err.should.be.false;
                done();
            });
        });

        it('should raise an error if the custom templating function doesn\'t return a value', function(done) {
            exifRenamer.process(imgExif, helpers.noop, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should use the output of a custom templating function', function(done) {
            var fn = function(metadata) {
                return path.join(metadata.dir, 'hello');
            };
            exifRenamer.process(imgExif, fn, function(err, result) {
                err.should.be.false;
                result.processed.dir.should.equal(result.original.dir);
                result.processed.name.should.equal('hello');
                done();
            });
        });

        it('should use DateTimeOriginal as datetime if available', function(done) {
            exifRenamer.process(imgExif, template, function(err, result) {
                result.original.datetime.should.eql(testExif.exif.DateTimeOriginal * 1000);
                done();
            });
        });

        it('should fallback to ctime if required', function(done) {
            exifRenamer.config.ctime_fallback = true;
            exifRenamer.config.require_exif = false;
            exifRenamer.process(imgNoExif, template, function(err, result) {
                result.original.datetime.should.eql(result.original.stat.ctime);
                done();
            });
        });

        it('should format datetime correctly', function(done) {
            var format = 'yy_mm_dd_HH_MM_ss';
            exifRenamer.process(imgExif, '{{dir}}:{{datetime "'+format+'"}}', function(err, result) {
                err.should.be.false;
                var datetime = result.original.datetime;
                result.processed.name.should.equal(dateformat(datetime, format));
                done();
            });
        });

        it('should calculate target paths correctly', function(done) {
            var srcDir = path.dirname(imgExif),
                name = path.basename(imgExif),
                parent = path.join(path.dirname(srcDir), name),
                sibling = path.join(path.dirname(srcDir), 'test', name),
                abs = path.join('/foo/bar', name),
                promises = [],
                examples = {
                    // empty = src
                    '{{file}}': imgExif,
                    ':{{file}}': imgExif,
                    // relative src
                    '.:{{file}}': imgExif,
                    './:{{file}}': imgExif,
                    // absolute + relative src
                    '{{dir}}/.:{{file}}': imgExif,
                    '{{dir}}/./:{{file}}': imgExif,
                    // relative parent
                    '..:{{file}}': parent,
                    '../:{{file}}': parent,
                    // absolute + relative parent
                    '{{dir}}/..:{{file}}': parent,
                    '{{dir}}/../:{{file}}': parent,
                    // relative sibling
                    '../test:{{file}}': sibling,
                    '../test/:{{file}}': sibling,
                    // absolute + relative sibling
                    '{{dir}}/../test:{{file}}': sibling,
                    '{{dir}}/../test/:{{file}}': sibling,
                    // absolute other
                    '/foo/bar:{{file}}': abs,
                    '/foo/bar/:{{file}}': abs
                };

            promises = _.map(examples, function(path, template) {
                return Q.nfcall(exifRenamer.process.bind(exifRenamer), imgExif, template);
            });

            Q.allSettled(promises)
            .then(function(results) {
                results.forEach(function(result) {
                    var expectedPath = examples[result.value.template];
                    result.value.processed.path.should.equal(expectedPath);
                });
                done();
            })
            .catch(done);
        });

    });

    /**
     * #rename(filepath, template, callback)
     */
    describe('#rename', function() {

        var tmpDir = path.join(__dirname, 'tmp'),
            tmpExif = path.join(tmpDir, 'exif.jpg');

        function cleanup() {
            if (fs.existsSync(tmpDir)) helpers.rmdir(tmpDir);
        }

        beforeEach(function(done) {
            cleanup();
            fs.mkdirSync(tmpDir);
            helpers.cp(imgExif, tmpExif, done);
        });

        after(function(done) {
            cleanup();
            done();
        });

        it('should raise errors as per #process', function(done) {
            exifRenamer.rename(imgPath, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should not overwrite files', function(done) {
            exifRenamer.config.overwrite.should.be.false;
            exifRenamer.rename(tmpExif, '{{file}}', function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should overwrite files when config.overwrite=true', function(done) {
            var targetPath = path.join(tmpDir, 'target.jpg');
            // create the target file
            helpers.cp(imgExif, targetPath, function() {
                fs.existsSync(targetPath).should.be.true;
                // rename to existing path
                exifRenamer.config.overwrite = true;
                exifRenamer.rename(tmpExif, '{{dir}}:target.jpg', function(err, result) {
                    err.should.be.false;
                    result.processed.path.should.equal(targetPath);
                    fs.existsSync(targetPath).should.be.true;
                    fs.existsSync(tmpExif).should.be.false;
                    done();
                });
            });
        });

        it('should not overwrite directories, regardless of configuration', function(done) {
            exifRenamer.config.overwrite = true;
            exifRenamer.rename(tmpExif, '{{dir}}:', function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should create necessary parent paths', function(done) {
            var noPath = path.join(tmpDir, 'nopath');
            fs.existsSync(noPath).should.be.false;
            exifRenamer.rename(tmpExif, './nopath:{{file}}', function(err, result) {
                err.should.be.false;
                fs.existsSync(noPath).should.be.true;
                path.join(noPath, path.basename(tmpExif)).should.equal(result.processed.path);
                fs.existsSync(result.processed.path).should.be.true;
                done();
            });
        });

        it('should not modify the filesystem if dryrun=true', function(done) {
            exifRenamer.config.dryrun = true;
            exifRenamer.rename(tmpExif, template, function(err, result) {
                err.should.be.false;
                fs.existsSync(result.processed.path).should.be.false;
                done();
            });
        });

    });

    /**
     * #rename_dir(dirpath, template [recursive=false, callback, itemCallback])
     */
    describe('#rename_dir', function() {

        var tmpFromDir = path.join(__dirname, 'tmp'),
            tmpFromDirSub = path.join(tmpFromDir, 'subdir'),
            tmpToDir = path.join(__dirname, 'tmp2'),
            imgs = [imgExif, imgNoExif];

        function cleanup() {
            if (fs.existsSync(tmpFromDir)) helpers.rmdir(tmpFromDir);
            if (fs.existsSync(tmpToDir)) helpers.rmdir(tmpToDir);
        }

        beforeEach(function(done) {
            cleanup();
            fs.mkdirSync(tmpFromDir);
            fs.mkdirSync(tmpFromDirSub);
            // copy images
            var promises = [];
            imgs.forEach(function(i) {
                var basename = path.basename(i);
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDir, '1_'+basename)));
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDir, '2_'+basename)));
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDir, '3_'+basename)));
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDirSub, '1_'+basename)));
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDirSub, '2_'+basename)));
                promises.push(Q.nfcall(helpers.cp, i, path.join(tmpFromDirSub, '3_'+basename)));
            });
            Q.all(promises).then(function() { done(); });
            exifRenamer.config.ctime_fallback = true;
            exifRenamer.config.require_exif = false;
        });

        after(function(done) {
            cleanup();
            done();
        });

        it('should raise an error if dirpath is not a valid directory', function(done) {
            exifRenamer.rename_dir(notDir, template, function(err) {
                err.should.be.an.instanceOf(Error);
                done();
            });
        });

        it('should return a promise', function() {
            var p = exifRenamer.rename_dir(tmpFromDir, template, _.noop);
            Q.isPromise(p).should.be.true;
        });

        it('should call the itemCallback for each file and the final callback once', function(done) {
            var itemCallback = sinon.spy(),
                callback = sinon.stub();

            exifRenamer.rename_dir(tmpFromDir, template, callback, itemCallback).then(function(results) {
                results.length.should.eql(imgs.length * 3);
                itemCallback.callCount.should.eql(imgs.length * 3);
                callback.callCount.should.eql(1);
                done();
            });
        });

        it('should rename all files in the source directory only when recursive=false', function(done) {
            exifRenamer.rename_dir(tmpFromDir, template, function(err, results) {
                err.should.be.false;
                results.length.should.equal(imgs.length * 3);
                results.forEach(function(r) {
                    fs.existsSync(r.original.path).should.be.false;
                    fs.existsSync(r.processed.path).should.be.true;
                });
                done();
            });
        });

        it('should rename all files in the source directory & it\'s sub-directories when recursive=true', function(done) {
            exifRenamer.rename_dir(tmpFromDir, template, true, function(err, results) {
                err.should.be.false;
                results.length.should.equal(imgs.length * 3 * 2);
                results.forEach(function(r) {
                    fs.existsSync(r.original.path).should.be.false;
                    fs.existsSync(r.processed.path).should.be.true;
                });
                done();
            });
        });

    });

    /**
     * #watch(dirpath, template, callback)
     */
    xdescribe('#watch (tests run slowly due to filesystem dependency)', function() {

        var watchDir = path.join(__dirname, 'tmp');

        function cleanup() {
            if (fs.existsSync(watchDir)) helpers.rmdir(watchDir);
        }

        beforeEach(function(done) {
            cleanup();
            fs.mkdirSync(watchDir);
            done();
        });

        after(function(done) {
            cleanup();
            done();
        });

        it('should rename any supported file created or modified in the watch directory', function(done) {
            var file = path.basename(imgExif),
                from = path.join(watchDir, file),
                to = path.join(watchDir, 'processed', file);

            this.timeout(15000);

            exifRenamer.watch(watchDir, '{{dir}}/processed:{{file}}', function() {
                fs.existsSync(from).should.be.false;
                fs.existsSync(to).should.be.true;
                done();
            });

            helpers.cp(imgExif, from, function() {
                fs.existsSync(from).should.be.true;
            });
        });

    });

});
