var exifRenamer = require('../lib/exif-renamer'),
    path = require('path'),
    helpers = require('./helpers'),
    img = path.resolve(__dirname, 'test.jpg');

helpers.ul('DEMO: exif-renamer#process', '=', '\n');
console.log('Getting EXIF data for', img, ':\n');
exifRenamer.exif(img).then(function(exifdata) {
    console.log(exifdata);
    console.log('');
});
