var S = require('string');

module.exports = {
    ul: function(text, ul, prefix, suffix) {
        ul = ul || '=';
        prefix = prefix || '';
        suffix = suffix || '';
        console.log(prefix + text + '\n' + S(ul).repeat(text.length) + suffix);
    }
};
