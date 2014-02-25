var _ = require('lodash'),
    Q = require('q'),
    helpers = require('./helpers'),
    exifRenamer = require('../lib/exif-renamer');

function dogeify(metadata) {
    var dogeisms = ['very', 'wow', 'so', 'much'];
    return [
        dogeisms[Math.floor(Math.random() * dogeisms.length)],
        'F' + metadata.exif.FNumber,
        metadata.file
    ].join('_');
}

var examples = {
    'Prefix the filename with the default datetime format':  '{{dir}}/{{datetime}}_{{file}}',
    'Prefix the filename with a custom datetime format':     '{{dir}}/{{datetime "yy-mm"}}_{{file}}',
    'Move the image to a "YYYY-MM" directory':               '{{dir}}/{{datetime "yyyy-mm"}}/{{file}}',
    'Prefix the parent directory with the date':             '{{dir}}/../{{date}} {{dirname}}/{{file}}',
    'Prefix the filename with the extension & camera model': '{{dir}}/{{EXT}}-{{image.Model}}-{{file}}',
    'Prefix the filename with the F-number':                 '{{dir}}/F{{exif.FNumber}}-{{file}}',
    'Prefix with an undefined EXIF property':                '{{dir}}/{{exif.NOPE}}-{{file}}',
    'Rename using a custom function':                        dogeify
};

helpers.ul('DEMO: exif-renamer#process', '=', '\n');

function render(title, result) {
    helpers.ul('EXAMPLE: ' + title, '-', '\n');
    console.log(helpers.clr.yellow('[tmpl] ', result.template));
    console.log(helpers.clr.cyan('[old]  ', result.original.path));
    console.log(helpers.clr.green('[new]  ', result.processed.path));
}

// rename using string-based patterns
Q.all(_.map(examples, function(template, description) {
    return exifRenamer.process(helpers.test_img, template).then(function(result) {
        render(description, result);
    });
})).done(function() {
    console.log('');
});
