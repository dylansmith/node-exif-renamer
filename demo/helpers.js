var _ = require('lodash'),
    path = require('path');

module.exports = {

    cli: require('cli'),
    clr: require('cli-color'),
    test_img: path.resolve(path.join(__dirname, 'img', 'exif.jpg')),

    ul: function(text, ul, prefix, suffix) {
        ul = ul || '=';
        prefix = prefix || '';
        suffix = suffix || '';
        console.log(this.clr.whiteBright(prefix + text + '\n' + _.repeat(ul, text.length) + suffix));
    }

};
