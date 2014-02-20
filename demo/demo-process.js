var path = require('path'),
    _ = require('lodash'),
    Q = require('q'),
    helpers = require('./helpers'),
    log = console.log,
    exifRenamer = require('../lib/exif-renamer'),
    img = path.resolve(__dirname, 'test.jpg'),
    examples, doge_prefixer;

doge_prefixer = function(fileinfo, metadata) {
    var dogeisms = ['very', 'wow', 'so', 'much'];
    console.log(arguments);
    return [dogeisms[Math.floor(Math.random() * dogeisms.length)], fileinfo.basename].join('_');
}

examples = {
        'Prefix the filename with the date':                     '{{date}}_{{file}}',
        'Prefix the filename with a custom date format':         '{{date "yy-mm"}}_{{file}}',
        'Move the image to a YYYY-MM directory':                 '{{date "yyyy-mm"}}/{{file}}',
        'Prefix the parent directory with the year':             '{{date "yyyy"}}-{{dir}}/{{file}}',
        'Prefix the filename with the extension & camera model': '{{EXT}}-{{image.Model}}-{{file}}',
        'Prefix the filename with the F-number':                 'F{{exif.FNumber}}-{{file}}',
        'Rename using a custom function':                        doge_prefixer
    };

helpers.ul('DEMO: exif-renamer#process', '=', '\n');

function render(title, result) {
    helpers.ul('EXAMPLE: ' + title, '-', '\n');
    log('template :', result.template);
    log('original :', result.original.path);
    log('processed:', result.processed.path);
}

// rename using string-based patterns
Q.all(_.map(examples, function(template, description) {
    return exifRenamer.process(img, template).then(function(result) {
        render(description, result);
    });
})).done(function() {
    log('');
});
