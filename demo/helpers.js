var S = require('string'),
    path = require('path');

module.exports = {

    clr: require('cli-color'),
    cli: require('cli'),
    test_img: path.resolve(path.join(__dirname, 'img', 'exif.jpg')),

    ul: function(text, ul, prefix, suffix) {
        ul = ul || '=';
        prefix = prefix || '';
        suffix = suffix || '';
        console.log(this.clr.whiteBright(prefix + text + '\n' + S(ul).repeat(text.length) + suffix));
    },

    reporter: function(err, result) {
        if (err) {
            cli.info(err);
        }
        if (result) {
            var tmpl = [
                clr.cyan('[old] ' + '{{original.path}}'),
                clr.green('[new] ' + '{{processed.path}}')
            ].join('\n');
            cli.info('Renamed successfully');
            console.log(Handlebars.compile(tmpl)(result));
            console.log('');
        }
    }

};
