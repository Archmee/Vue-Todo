define(function() {
    var db = window.localStorage;

    var get = function(key) {
        return JSON.parse(db.getItem(key));
    };

    var set = function(key, value) {
        db.setItem(key, JSON.stringify(value));
    };

    var data = function(key, value) {
        if (value === null || value === undefined) {
            return get(key);
        } else {
            return set(key, value);
        }
    };

    var removeItem = function(key) {
        db.removeItem(key);
    };

    var remove = function(keys) {
        if (typeof keys === 'string') {
            removeItem(keys);
        } else if (keys instanceof Array) {
            keys.forEach(function(key) {
                removeItem(key);
            });
        }
    };

    var clear = function() {
        db.clear();
    };

    return {
        get: get,
        set: set,
        data: data,
        remove: remove
    };
});
