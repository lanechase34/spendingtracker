component singleton accessors="true" hint="Service layer for generating colors using HSV algorithm" {

    /**
     * Create random color using HSV (hue, saturation, value) algorithm
     */
    public string function generateColor() {
        var rgb = hsvToRgb(
            h = randRange(0, 359, 'SHA1PRNG'),
            s = .5, // saturation
            v = .95 // base value (lightness)
        )

        return '#toHex(rgb[1])##toHex(rgb[2])##toHex(rgb[3])#';
    }

    /**
     * Converts RGB number to hex
     */
    private string function toHex(required numeric num) {
        return right('00#formatBaseN(num, 16)#', 2);
    }

    /**
     * HSV algorithm in RGB format
     */
    private array function hsvToRgb(h, s, v) {
        var r;
        var g;
        var b;

        var i;
        var f;
        var p;
        var q;
        var t;

        var hm;

        hm = h % 360;
        i  = floor(hm / 60);
        f  = hm / 60 - i;
        p  = v * (1 - s);
        q  = v * (1 - f * s);
        t  = v * (1 - (1 - f) * s);

        switch(i) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
            case 1:
                r = q;
                g = v;
                b = p;
                break;
            case 2:
                r = p;
                g = v;
                b = t;
                break;
            case 3:
                r = p;
                g = q;
                b = v;
                break;
            case 4:
                r = t;
                g = p;
                b = v;
                break;
            default:
                r = v;
                g = p;
                b = q;
                break;
        }

        return [round(r * 255), round(g * 255), round(b * 255)];
    }

}
