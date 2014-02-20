var path = require('path'),
    fs = require('fs'),
    helpers = require('./helpers'),
    log = console.log,
    exifRenamer = require('../lib/exif-renamer'),
    watch_dir = path.resolve(__dirname, 'watch_target'),
    stdin = process.openStdin(),
    src_file = path.resolve(__dirname, 'test.jpg');

helpers.ul('DEMO: exif-renamer#watch', '=', '\n', '\n');
log('Press <Enter> to trigger file creation in the watch directory...');

// watch the target dir for new images and rename them
exifRenamer.watch(watch_dir, 'processed/{{date}}_{{file}}', function(err, result) {
    helpers.ul('CHANGE DETECTED', '=', '\n');
    log('template :', result.template);
    log('original :', result.original.path);
    log('processed:', result.processed.path);
});

// create file every time the Enter key is pressed
stdin.on('data', function() {
    var target_file = path.join(watch_dir, Date.now() + '_test.jpg');
    log('creating: ' + target_file);
    fs.createReadStream(src_file).pipe(fs.createWriteStream(target_file));
});
