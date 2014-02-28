var exifRenamer = require('../lib/exif-renamer')(),
    helpers = require('./helpers');

helpers.ul('DEMO: exif-renamer#process', '=', '\n');
console.log('Getting EXIF data for', helpers.test_img, ':\n');
exifRenamer.exif(helpers.test_img, function(err, exifdata) {
    console.log(exifdata);
    console.log('');
});
