'use strict'
var express = require('express');
var router = express.Router();
var crypto = require('../lib/cryptography');

router.use(function (req, res, next) {
    res.locals.general = true;
    next();
});

// 新闻列表
router.get('/news', auth.checkRole('news', 'query'), function (req, res, next) {
    db.news.find()
        .sort({ time: -1 })
        .skip(10 * (req.query.p - 1))
        .limit(10)
        .exec()
        .then(function (news) {
            res.locals.news = news;
            return db.news.count().exec();
        })
        .then(function (count) {
            var page = res.locals.page = req.params.page == null ? 1 : req.query.p;
            var pageCount = res.locals.pageCount = parseInt((count + 5 - 1) / 5);
            var start = res.locals.start = (page - 5) < 1 ? 1 : (page - 5);
            var end = res.locals.end = (start + 10) > pageCount ? pageCount : (start + 10);
            res.render('general/news', { title: '新闻公告' });
        })
        .then(null, next);
});

// 展示新闻内容
router.get('/news/:id', auth.checkRole('news', 'query'), function (req, res, next) {
    db.news.findById(req.params.id)
        .select('_id title time content')
        .exec()
        .then(function (news) {
            if (news)
                res.render('general/newsShow', { title: news.title, news: news });
            else
            {
                res.status(404);
                next();
            }
        })
        .then(null, next);
});

// 发布新闻
router.post('/news/create', auth.checkRole('news', 'modify'), function (req, res, next) {
    let news = new db.news();
    news.title = '新建新闻';
    news.content = '<p>请在此处填写新闻内容</p>';
    news.summary = '请在此处填写新闻内容';
    news.time = Date.now();
    news.save(function (err, news) {
        res.redirect('/general/news/edit/' + news._id);
    });
});

// 删除新闻
router.post('/news/delete/:id', auth.checkRole('news', 'modify'), function (req, res, next) {
    db.news.remove({ _id: req.params.id })
        .exec()
        .then(function () {
            res.redirect('/general/news');
        })
        .then(null, next);
});

// 修改新闻
router.get('/news/edit/:id', auth.checkRole('news', 'modify'), function (req, res, next) {
    db.news.findById(req.params.id)
        .select('_id title content')
        .exec()
        .then(function (news) {
            res.render('general/newsEdit', { title: '编辑新闻', news: news });
        })
        .then(null, next);
});

// 修改新闻
router.post('/news/edit/:id', auth.checkRole('news', 'modify'), function (req, res, next) {
    let summary = req.body.content.replace(/<[^>]+>/g, '');
    if (summary.length >= 255)
        summary = summary.substring(0, 247) + '...';
    console.log(summary);
    db.news.update({ _id: req.params.id }, {
        title: req.body.title,
        content: req.body.content,
        summary: summary
    })
        .exec()
        .then(function () {
            res.redirect('/general/news/' + req.params.id);
        })
        .then(null, next);
});

// 部门列表
router.get('/department', auth.checkRole('department', 'modify'), function (req, res, next) {
    let query = db.departments.find();
    if (req.query.title)
        query = query.where({ title: new RegExp('.*' + req.query.title + '.*') });
    if (req.query.type)
        query = query.where({ type: req.query.type });
    _.clone(query)
        .count()
        .exec()
        .then(function (count) {
            var page = res.locals.page = req.query.p || 1;
            var pageCount = res.locals.pageCount = parseInt((count + 5 - 1) / 5);
            var start = res.locals.start = (page - 5) < 1 ? 1 : (page - 5);
            var end = res.locals.end = (start + 10) > pageCount ? pageCount : (start + 10);
            return query
                .skip(50 * (page - 1))
                .limit(50)
                .populate('user')
                .exec();
        })
        .then(function (departments) {
            res.locals.departments = departments;
            return Promise.all(departments.map(x => {
                return db.users.findOne({ department: x._id, role: '部门主管' }).select('name').exec();
            }));
        })
        .then(function (users) {
            for (let i = 0; i < users.length; i++) {
                if (users[i])
                    res.locals.departments[i].master = users[i].name;
                else
                    res.locals.departments[i].master = '未指派';
            }
            return Promise.all(res.locals.departments.map(x => {
                return db.users.find({ department: x._id }).count().exec();
            }));
        })
        .then(function (counts) {
            for (let i = 0; i < counts.length; i++) {
                res.locals.departments[i].count = counts[i];
            }
            res.render('general/department', { title: '部门列表' });
        })
        .then(null, next);
});

// 部门员工信息
router.get('/department/:id', auth.checkRole('department', 'query'), function (req, res, next) {
    db.departments.findById(req.params.id)
        .exec()
        .then(function (department) {
            res.locals.department = department;
            return db.users.find({ department: department._id }).sort('role').exec();
        })
        .then(function (users) {
            res.locals.users = users;
            res.render('general/departmentDetail', { title: res.locals.department.title });
        })
        .then(null, next);
});

// 编辑部门
router.get('/department/edit/:id', auth.checkRole('department', 'modify'), function (req, res, next) {
    db.departments.findById(req.params.id)
        .exec()
        .then(function (department) {
            res.render('general/departmentEdit', { title: department.title, department: department });
        })
        .then(null, next)
});

// 编辑部门
router.post('/department/edit/:id', auth.checkRole('department', 'modify'), function (req, res, next) {
    db.departments.update({ _id: req.params.id }, {
        title: req.body.title,
        type: req.body.type,
        city: req.body.city,
        district: req.body.district,
        address: req.body.address
    })
        .exec()
        .then(function () { res.send('OK') })
        .then(null, next);
});

// 删除部门
router.post('/department/delete/:id', auth.checkRole('department', 'modify'), function (req, res, next) {
    db.departments.remove({ _id: req.params.id })
        .exec()
        .then(function () { res.send('OK'); })
        .then();
});

// 创建部门
router.post('/department/create', auth.checkRole('department', 'modify'), function (req, res, next) {
    let department = new db.departments();
    department.title = '新建部门';
    department.type = '普通部门';
    department.save(function (err, department) {
        res.redirect('/general/department/' + department._id);
    });
});

// 职工列表
router.get('/employee', auth.checkRole('employee', 'query'), function (req, res, next) {
    let query;
    db.departments.find()
        .select('_id title')
        .exec()
        .then(function (departments) {
            res.locals.departments = departments;
            query = db.users.find();
            if (req.query.name)
                query = query.where({ name: req.query.name });
            if (req.query.jobNumber)
                query = query.where({ jobNumber: req.query.jobNumber });
            if (req.query.department)
                query = query.where({ department: req.query.department });
            if (req.query.role)
                query = query.where({ role: req.query.role });
            return _.clone(query).count().exec();
        })
        .then (function (count) {
            var page = res.locals.page = req.query.p || 1;
            var pageCount = res.locals.pageCount = parseInt((count + 5 - 1) / 5);
            var start = res.locals.start = (page - 5) < 1 ? 1 : (page - 5);
            var end = res.locals.end = (start + 10) > pageCount ? pageCount : (start + 10);
            return query.populate('department').skip(50 * (page - 1)).limit(50).exec();
        })
        .then(function (users) {
            res.locals.users = users;
            res.render('general/employee', { title: '职工管理' });
        })
        .then(null, next);
});

// 职工信息
router.get('/employee/:id', auth.checkRole('employee', 'query'), function (req, res, next) {
    db.users.findById(req.params.id)
        .populate({ path: 'department', select: '_id title' })
        .exec()
        .then(function (user) {
            res.render('general/employeeDetail', { title: user.name, user: user });
        })
        .then(null, next);
});

// 职工担保人信息
router.get('/employee/cautioner/:id', auth.checkRole('employee-private', 'query'), function (req, res, next) {
    db.users.findById(req.params.id)
        .populate({ path: 'department', select: '_id title' })
        .exec()
        .then(function (user) {
            res.render('general/employeeCautioner', { title: user.name, user: user });
        })
        .then(null, next);
});

// 编辑职工
router.get('/employee/edit/:id', auth.checkRole('employee', 'modify'), function (req, res, next) {
    db.users.findById(req.params.id)
        .exec()
        .then(function (user) {
            res.locals.user = user;
            return db.departments.find()
                .select('_id title')
                .exec();
        })
        .then(function (departments) {
            res.locals.departments = departments;
            res.render('general/employeeEdit', { title: res.locals.user.name });
        })
        .then(null, next);
});

// 编辑职工
router.post('/employee/edit/:id', auth.checkRole('employee', 'modify'), function (req, res, next) {
    if (req.files.file) {
        var writestream = db.gfs.createWriteStream({
            filename: req.files.file.originalname,
            metadata: { public: true }
        });
        db.fs.createReadStream(req.files.file.path).pipe(writestream);
        writestream.on('close', function (file) {
            db.fs.unlink(req.files.file.path);
            db.users.update({ _id: req.params.id }, { photo: file._id }).exec();
        });
    }
    let options = {
        jobNumber: req.body.jobNumber || '',
        name: req.body.name || '',
        sex: req.body.sex,
        takeOfficeTime: req.body.takeOfficeTime,
        role: req.body.role,
        department: req.body.department,
        PRCIdentity: req.body.PRCIdentity || '',
        address: req.body.address || '',
        phone: req.body.phone || '',
        diploma: req.body.diploma || '',
        cautioner: {
            name: req.body['cautioner-name'] || '',
            PRCIdentity: req.body['cautioner-PRCIdentity'] || '',
            address: req.body['cautioner-address'] || '',
            phone: req.body['cautioner-phone'] || ''
        }
    };
    if (req.body.password) {
        let salt = crypto.salt();
        options.salt = salt;
        options.password = crypto.sha256(req.body.password, salt);
    }
    db.users.update({ _id: req.params.id }, options)
        .exec()
        .then(function () {
            res.redirect('/general/employee/' + req.params.id);
        })
        .then(null, next);
});

module.exports = router;
