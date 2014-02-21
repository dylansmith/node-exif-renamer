var exifRenamer = require('../lib/exif-renamer'),
    path = require('path'),
    helpers = require('./helpers');

helpers.ul('DEMO: exif-renamer#process', '=', '\n');
console.log('Getting EXIF data for', helpers.test_img, ':\n');
exifRenamer.exif(helpers.test_img).then(function(exifdata) {
    console.log(exifdata);
    console.log('');
});
