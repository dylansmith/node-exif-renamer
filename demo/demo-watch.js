var path = require('path'),
    fs = require('fs'),
    _ = require('lodash'),
    log = console.log,
    exifRenamer = require('../lib/exif-renamer'),
    watch_dir = path.resolve(__dirname, 'watch_target');

function ul(text, chr) {
    chr = chr || '=';
    return text + '\n' + _.times(text.length, function() { return chr; }).join('');
}

log('\n' + ul('DEMO: watching the filesystem for changes'));

// watch a target dir for new image and rename them
exifRenamer.watch(watch_dir, 'processed/%date_%file', function(err, result) {
    var u = '';
    description = 'CHANGE DETECTED';
    _.times(description.length, function() { u += '='; });
    log([,description,u,].join('\n'));
    log('template :', result.template);
    log('original :', result.original.path);
    log('processed:', result.processed.path);
    log('');
});

// create file everytime a key is pressed
log('Press <Enter> to trigger file creation in the watch directory...');
var src_file = path.resolve(__dirname, 'test.jpg');
var stdin = process.openStdin();
stdin.on('data', function(chunk) {
    var target_file = path.join(watch_dir, Date.now() + '_test.jpg');
    log('creating: ' + target_file);
    fs.createReadStream(src_file).pipe(fs.createWriteStream(target_file));
});
