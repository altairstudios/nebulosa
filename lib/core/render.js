var _ = require('underscore');
var cloudinary = require('cloudinary');
var debug = require('debug')('keystone:core:render');
var fs = require('fs');
var jade = require('jade');
var moment = require('moment');
var numeral = require('numeral');
var utils = require('keystone-utils');

/**
 * Renders a Keystone View
 *
 * @api private
 */

var templateCache = {};

function render(req, res, view, ext) {
	var nebulosa = this;
	if(!nebulosa.templateCache) {
		nebulosa.templateCache = templateCache;
	}

	var templatePath = __dirname + '/../../templates/views/' + view + '.jade';

	debug('rendering ' + templatePath);

	var jadeOptions = {
		filename: templatePath,
		pretty: nebulosa.get('view pretty') || nebulosa.get('env') !== 'production'
	};

	// TODO: Allow custom basePath for extensions... like this or similar
	// if (nebulosa.get('extensions')) {
	// 	pugOptions.basedir = nebulosa.getPath('extensions') + '/templates';
	// }

	var compileTemplate = function() {
		debug('compiling');
		return jade.compile(fs.readFileSync(templatePath, 'utf8'), jadeOptions);
	};

	var template = nebulosa.get('viewCache')
		? nebulosa.templateCache[view] || (nebulosa.templateCache[view] = compileTemplate())
		: compileTemplate();

	if (!res.req.flash) {
		console.error('\nNebulosaJS Runtime Error:\n\napp must have flash middleware installed. Try adding "connect-flash" to your express instance.\n');
		process.exit(1);
	}
	var flashMessages = {
		info: res.req.flash('info'),
		success: res.req.flash('success'),
		warning: res.req.flash('warning'),
		error: res.req.flash('error'),
		hilight: res.req.flash('hilight')
	};

	var locals = {
		_: _,
		moment: moment,
		numeral: numeral,
		messages: _.any(flashMessages, function(msgs) { return msgs.length; }) ? flashMessages : false,
		env: nebulosa.get('env'),
		brand: nebulosa.get('brand'),
		appversion : nebulosa.get('appversion'),
		nav: nebulosa.nav,
		lists: nebulosa.lists,
		js: 'javascript:;',// eslint-disable-line no-script-url
		utils: utils,
		User: nebulosa.lists[nebulosa.get('user model')],
		user: req.user,
		title: 'Nebulosa',
		signout: nebulosa.get('signout url'),
		backUrl: nebulosa.get('back url') || '/',
		section: {},
		version: nebulosa.version,
		csrf_header_key: nebulosa.security.csrf.CSRF_HEADER_KEY,
		csrf_token_key: nebulosa.security.csrf.TOKEN_KEY,
		csrf_token_value: nebulosa.security.csrf.getToken(req, res),
		csrf_query: '&' + nebulosa.security.csrf.TOKEN_KEY + '=' + nebulosa.security.csrf.getToken(req, res),
		ga: {
			property: nebulosa.get('ga property'),
			domain: nebulosa.get('ga domain')
		},
		wysiwygOptions: {
			enableImages: nebulosa.get('wysiwyg images') ? true : false,
			enableCloudinaryUploads: nebulosa.get('wysiwyg cloudinary images') ? true : false,
			additionalButtons: nebulosa.get('wysiwyg additional buttons') || '',
			additionalPlugins: nebulosa.get('wysiwyg additional plugins') || '',
			additionalOptions: nebulosa.get('wysiwyg additional options') || {},
			overrideToolbar: nebulosa.get('wysiwyg override toolbar'),
			skin: nebulosa.get('wysiwyg skin') || 'keystone',
			menubar: nebulosa.get('wysiwyg menubar'),
			importcss: nebulosa.get('wysiwyg importcss') || ''
		}
	};

	// optional extensions to the local scope
	_.extend(locals, ext);

	// add cloudinary locals if configured
	if (nebulosa.get('cloudinary config')) {
		try {
			debug('adding cloudinary locals');
			var cloudinaryUpload = cloudinary.uploader.direct_upload();
			locals.cloudinary = {
				cloud_name: nebulosa.get('cloudinary config').cloud_name,
				api_key: nebulosa.get('cloudinary config').api_key,
				timestamp: cloudinaryUpload.hidden_fields.timestamp,
				signature: cloudinaryUpload.hidden_fields.signature,
				prefix: nebulosa.get('cloudinary prefix') || '',
				folders: nebulosa.get('cloudinary folders'),
				uploader: cloudinary.uploader
			};
			locals.cloudinary_js_config = cloudinary.cloudinary_js_config();
		} catch(e) {
			if (e === 'Must supply api_key') {
				throw new Error('Invalid Cloudinary Config Provided\n\n' +
					'See http://keystonejs.com/docs/configuration/#services-cloudinary for more information.');
			} else {
				throw e;
			}
		}
	}

	// fieldLocals defines locals that are provided to each field's `render` method
	locals.fieldLocals = _.pick(locals, '_', 'moment', 'numeral', 'env', 'js', 'utils', 'user', 'cloudinary');

	if(template) {
		var html = template(_.extend(locals, ext));

		debug('sending down html');
		res.send(html);
	} else {
		res.status(500).send('Error');
	}
	
}

module.exports = render;
