component singleton accessors="true" hint="Service layer for interacting with imagemagick" {

    property name="imageMagick" inject="coldbox:setting:imageMagick";

    /**
     * Verify image magick is running
     * @CFLintIgnore AVOID_USING_CFEXECUTE_TAG
     */
    public boolean function verifyImageMagick() {
        try {
            cfexecute(
                name      = "#imageMagick#",
                arguments = "identify --version",
                timeout   = 30
            );
        }
        catch(any e) {
            return false;
        }
        return true;
    }

    /**
     * Uses imagick identify to check if path is a valid image
     *
     * @path full path to image
     * @CFLintIgnore AVOID_USING_CFEXECUTE_TAG
     */
    public boolean function validIdentify(required string path) {
        try {
            cfexecute(
                name      = "#imageMagick#",
                arguments = "identify ""#path#""",
                timeout   = 30
            );
        }
        catch(any e) {
            return false;
        }
        return true;
    }

    /**
     * Uses imagick mogrify to convert the upload to webp and decrease quality
     *
     * @path full path to image
     * @CFLintIgnore AVOID_USING_CFEXECUTE_TAG
     */
    public boolean function convertToWebp(required string path, numeric quality = 50) {
        try {
            cfexecute(
                name      = "#imageMagick#",
                arguments = "mogrify -format webp -thumbnail 750x750 -strip -quality #quality# ""#path#""",
                timeout   = 30
            );
        }
        catch(any e) {
            return false;
        }
        return true;
    }

    /**
     * Validate the incoming image upload
     * If valid, move to the user's upload directory and return the filename generated
     *
     * @formField  image form field
     * @extensions
     */
    public string function validateUpload(
        required string formField,
        required string uploadDirectory,
        string extensions = 'png,jpg,jpeg,webp,heic'
    ) {
        var result = '';

        // Attempt file upload to temp directory
        try {
            var upload = fileUpload(
                destination  = getTempDirectory(),
                fileField    = formField,
                accept       = 'image/png,image/jpeg,image/webp,image/heic',
                nameConflict = 'makeUnique',
                strict       = true
            );
        }
        catch(any e) {
            return result;
        }

        var uploadpath = '#upload.serverdirectory#/#upload.serverfile#';
        uploadpath     = replace(uploadpath, '\', '/', 'all');

        // Check if valid image
        if(!validIdentify(uploadpath) || !listFindNoCase(extensions, upload.serverfileext)) {
            fileDelete(uploadpath);
            return result;
        }

        // Attempt to convert the upload to .webp
        var validConvert = convertToWebp(uploadpath);

        // Conversion failed
        if(!validConvert) {
            fileDelete(uploadpath);
            return result;
        }

        var oldPath = uploadpath;
        uploadpath  = '#left(uploadpath, uploadpath.len() - upload.serverfileext.len())#webp';

        // Rename and move to uploads directory
        var newname = left(createUUID().replace('-', '', 'all'), 25);
        fileMove(uploadpath, '#uploadDirectory#/#newname#.webp');

        // Delete the temp file, if it was not .webp already
        if(fileExists(oldPath)) {
            fileDelete(oldPath);
        }

        // Return the new name
        return newname;
    }

}
