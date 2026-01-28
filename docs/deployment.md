## Github Actions

#### To Do, files are mostly set up, just need to test and verify results

## Manual Deploy

### Backend

Rsync to transfer the files to the backend. Commands assume WSL

### Setup

1. Make copy of private key on ubuntu for rsync

    ```
    mkdir -p ~/.ssh
    cp /mnt/c/${PATH_TO_KEY}/key.pem ~/.ssh/spendingtrackerkey.pem
    ```

2. Change permissions to r+w only on ubuntu

    ```
    chmod 600 ~/.ssh/spendingtrackerkey.pem
    ```

### Backend

1. Deploy command to update backend code

    ```
    rsync -avz -e "ssh -i ~/.ssh/spendingtrackerkey.pem" "/mnt/c/${PATH_TO_REPO}/spendingtracker/backend/" --exclude='Dockerfile' --exclude='.dockerignore' --exclude='.env' --exclude='README.md' --exclude='/tests' --exclude='/modules' --exclude='/coldbox' --exclude='/env' --exclude='/database/seeds' ${LIGHTSAIL_USERNAME}@${LIGHTSAIL_IP}:/var/www/wwwroot/spendingtracker_backend/
    ```

### Frontend

1. Build frontend files into frontend/build

    ```
    npm run build
    ```

2. Deploy command to update frontend code

    ```
    rsync -avz -e "ssh -i ~/.ssh/spendingtrackerkey.pem" "/mnt/c/${PATH_TO_REPO}/spendingtracker/frontend/build/" ${LIGHTSAIL_USERNAME}@${LIGHTSAIL_IP}:/var/www/wwwroot/spendingtracker_frontend/
    ```

### NGINX

- Test current configuration `sudo nginx -t`
- Reload configuration `sudo systemctl reload nginx`

## Server Setup

Stack:

- Ubuntu 24.04
- Nginx Web Server
- UWF
- Cloudflare

1.  Setup

    ```
    sudo apt-get update
    sudo apt upgrade
    sudo apt install default-jdk

    sudo apt install nginx
    sudo apt install ufw
    ```

2.  UFW Set up

    Allow ports 80 (http), 443 (https), and 22 (ssh)

    ```
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx HTTPS'
    ```

    Block port running on commandbox, this uses 8082

    ```
    sudo ufw deny 8082
    ```

3.  Nginx Set up

    Listen to both http, https traffic. Redirect all http traffic to https.
    Listen for server name chaselane.dev/spendingtracker/api/v1, on match, reverse proxy to commandbox using port 8082.
    Cloudflare origin cert and private key are stored in /etc/nginx/ssl/chaselane

    `config/nginx.conf` for nginx.conf

    `config/site.conf` for sites-available/chaselane.dev

4.  Enable the site in nginx

    ```
    sudo ln -s /etc/nginx/sites-available/chaselane.dev /etc/nginx/sites-enabled/
    ```

5.  Imagemagick

    Ubuntu 24.04 install steps. This includes HEIC format support

    ```
    # Remove bundled ImageMagick

    sudo apt remove imagemagick -y

    # Install image dependencies

    sudo apt-get install -y \
    pkg-config \
    build-essential \
    libltdl-dev \
    libheif-dev \
    libpng-dev \
    libjpeg-dev \
    libwebp-dev

    # Clone source

    cd /usr/local/src
    sudo git clone --depth 1 --branch 7.1.0-54 https://github.com/ImageMagick/ImageMagick.git /usr/local/src/ImageMagick
    cd /usr/local/src/ImageMagick

    # Configure

    sudo ./configure \
    --with-modules \
    --with-heic=yes \
    --with-png=yes \
    --with-jpeg=yes \
    --with-webp=yes

    # Build

    sudo make
    sudo make install
    sudo ldconfig /usr/local/lib

    # Check install

    identify --version
    convert -list format

    # Enforce maximum security policy

    cd /usr/local/etc/ImageMagick-7
    sudo rm policy.xml
    sudo wget -O policy.xml https://imagemagick.org/source/policy-websafe.xml

    # Allow png, jpeg, webp, and heic files

    sudo nano policy.xml

    <policy domain="resource" name="time" value="30"/>
    <policy domain="resource" name="width" value="8KP"/>
    <policy domain="resource" name="height" value="8KP"/>
    <policy domain="module" rights="read|write" value="{JPEG,PNG,WEBP,HEIC}"/>

    ```

6.  Create server folders

    ```
    sudo mkdir -p /var/www/wwwroot/spendingtracker_backend
    sudo mkdir -p /var/www/wwwroot/spendingtracker_frontend
    ```

7.  Install commandbox per commandbox docs

8.  Make and modify env as needed

    ```
    sudo touch .env
    sudo nano .env
    ```

9.  Grant read/write to server.json

    `sudo chmod u+w server.json`

10. Run deploys and run the following commands in box

    ```
    install --production
    migrate fresh # only run once - this initializes the database
    migrate up
    server start
    ```
