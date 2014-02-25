var path = require('path'),
    fs = require('fs'),
    helpers = require('./helpers'),
    exifRenamer = require('../lib/exif-renamer'),
    watch_dir = path.resolve(__dirname, 'watch'),
    stdin = process.openStdin();

helpers.ul('DEMO: exif-renamer#watch', '=', '\n');
console.log(helpers.clr.yellow('Press <Enter> to trigger file creation in the watch directory...'));

// watch the target dir for new images and rename them
exifRenamer.watch(watch_dir, '{{dir}}/processed/{{file}}', function(err, result) {
    if (err) {
        helpers.cli.error(err);
    }
    else {
        console.log(helpers.clr.yellow('[tmpl] ', result.template));
        console.log(helpers.clr.cyan('[old]  ', result.original.path));
        console.log(helpers.clr.green('[new]  ', result.processed.path));
    }
});

// create file every time the Enter key is pressed
stdin.on('data', function() {
    var target_file = path.join(watch_dir, 'test.jpg');
    console.log('[exif-renamer] creating: ' + target_file);
    fs.createReadStream(helpers.test_img).pipe(fs.createWriteStream(target_file));
});
