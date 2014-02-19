var path = require('path'),
    _ = require('lodash'),
    Q = require('q'),
    exifRenamer = require('../lib/exif-renamer'),
    img = path.resolve(__dirname, 'test.jpg'),
    examples = {
        'Prefix with a default datetime':                   '%date_%file',
        'Prefix with "YY-MM" datetime':                     '%yy-%mm-%file',
        'Move to YYYY-MMM directory':                       '%yyyy-%mm/%file',
        'Prefix parent directory with year':                '%yyyy-%dir/%file',
        'Prefix with the file extension and camera model':  '%EXT-%{image.Model}-%file',
        'Prefix with F-number':                             'F%{exif.FNumber}-%file',
        'Rename using a custom function': function(filepath, data) { return 'CUSTOM-' + path.basename(filepath); }
    };

function ul(text, chr) {
    chr = chr || '=';
    return text + '\n' + _.times(text.length, function() { return chr; }).join('');
}

function render(description, result) {
    console.log(ul('EXAMPLE: ' + description));
    console.log('template :', result.template);
    console.log('original :', result.original.path);
    console.log('processed:', result.processed.path);
    console.log('');
}

// rename using string-based patterns
console.log('');
_.forEach(examples, function(template, description) {
    exifRenamer.process(img, template).then(function(result) {
        render(description, result);
    });
});
