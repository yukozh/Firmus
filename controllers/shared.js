var express = require('express');
var router = express.Router();

router.get('/login', auth.guest, function(req, res, next) {
    res.render('shared/login', { title: '登录' });
});

module.exports = router;