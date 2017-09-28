requirejs.config({
    paths: {
        app: './dist/js/todo',
        store: './dist/js/store',
        vue: './lib/vue'
    }
});

require(['app'],
function(app) {
    if (!window.localStorage) {
        alert('该应用不支持低版本浏览器！');
    } else {
        app.init();
    }
});