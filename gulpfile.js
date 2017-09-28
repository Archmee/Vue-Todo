/* jshint ignore: start */
var gulp    = require('gulp');
var less    = require('gulp-less');
var imgmin  = require('gulp-imagemin');
var cssmin  = require('gulp-clean-css');
var csslint = require('gulp-csslint');
var rename  = require('gulp-rename');
var uglify  = require('gulp-uglify');
var babel   = require('gulp-babel');

var clear   = require('del');
var bSync   = require('browser-sync');
var reload  = bSync.reload;

// 清理目标
gulp.task('clear-all', function(done) {
    return clear(['./dist/**/*'], done);
});
gulp.task('clear-img', function(done) {
    return clear(['./dist/img/*'], done);
});
gulp.task('clear-css', function(done) {
    return clear(['./dist/css/*'], done);
});
gulp.task('clear-js', function(done) {
    return clear(['./dist/js/*'], done);
});

// 压缩图片
gulp.task('image', ['clear-img'], function() {

    return gulp.src(['./src/img/*'])
        .pipe(imgmin())
        .pipe(gulp.dest('./dist/img/'))
        .pipe(reload({ stream:true })); //注入而不是刷新
});

// 预编译语言转换css
gulp.task('tocss', ['clear-css'], function() {

    return gulp.src(['src/less/*.less', '!src/less/def.less'])
        .pipe(less())
        // .pipe(csslint({"ids": false}))
        // .pipe(csslint.formatter())
        .pipe(cssmin({compatibility: 'ie8'}))
        .pipe(gulp.dest('dist/css/'))
        .pipe(reload({ stream:true })); ////注入而不是刷新
});

// js脚本
gulp.task('script', ['clear-js'], function() {

    return gulp.src(['./src/js/*.js'])
        // .pipe(jshint())
        // .pipe(jshint.reporter('default'))
        .pipe(babel())
        .pipe(uglify())
        .pipe(gulp.dest('./dist/js/'))
        .pipe(reload({ stream:true }));
});

// 打开服务器并监听文件变化
gulp.task('file-watch', ['image', 'tocss', 'script'], function() {

    // 启动服务器
    bSync({
        server: {
          baseDir: './'
        }
    });

    gulp.watch('src/img/*',  ['image']);  //监视图片资源
    gulp.watch('src/less/*', ['tocss']); //监视less修改
    gulp.watch('src/js/*',   ['script']); //监视js
    gulp.watch(['index.html', 'main.js'], [reload]);  //html文件改变都刷新浏览器
});

gulp.task('default', ['file-watch']); //默认启动server