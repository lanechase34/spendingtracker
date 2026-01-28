component singleton {

    property name="cacheStorage" inject="cachebox:coldboxStorage";

    /**
     * Cache to keep track number of hits per unique key
     *
     * @key    cache key
     * @limit  limit of requests allowed in 'window'
     * @window window of time defined in seconds
     */
    public boolean function hit(
        required string key,
        required numeric limit,
        required numeric window
    ) {
        var data = cacheStorage.get(key);

        if(isNull(data)) {
            data = {count: 1, expiresAt: now().add(datePart = 's', number = window)};
            cacheStorage.set(key, data, window);
            return true;
        }

        if(data.count >= limit) {
            return false;
        }

        data.count++;
        cacheStorage.set(key, data, dateDiff('s', now(), data.expiresAt));

        return true;
    }

    /**
     * Build the cache key based on the incoming mode
     * Options include ip, email, ip+email
     */
    public string function buildKey(
        required string mode,
        required string ip,
        required string email
    ) {
        switch(mode) {
            case 'ip':
                return ip;
            case 'email':
                return lCase(email);
            case 'ip+email':
                if(!len(email)) return '';
                return '#ip#:#lCase(email)#';
        }

        return '';
    }

}
