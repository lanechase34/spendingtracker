<cfoutput>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ##fafafa; line-height: 1.6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ##fafafa; padding: 40px 0;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: ##ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                        <td style="padding: 32px 40px; background-color: ##1a1a1a; border-radius: 8px 8px 0 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="vertical-align: middle; padding-right: 8px; line-height: 0;">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" role="img" aria-label="SpendingTracker logo" style="display: block;">
                                                        <path fill="##66bb6a" d="m42.668 16 6.108 6.108 -13.012 13.012 -10.668 -10.668 -19.764 19.788L9.092 48l16 -16 10.668 10.668 16.8 -16.772L58.668 32V16z"/>
                                                    </svg>
                                                </td>
                                                <td style="vertical-align: middle; line-height: 0;">
                                                    <h1 style="margin: 0; padding: 0; color: ##ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; line-height: 1.2;">
                                                        SpendingTracker
                                                    </h1>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 48px 40px;">
                            <h2 style="text-align: center; margin: 0 0 24px; color: ##212121; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">
                                Verify Your Email Address
                            </h2>
                            
                            <p style="margin: 0 0 24px; color: ##424242; font-size: 16px; line-height: 1.5;">
                                Thank you for registering with SpendingTracker! Please verify your email address using the code below to complete your account setup.
                            </p>
                                             
                            <!-- OTP Code Box -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 32px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: ##f5f5f5; border: 2px solid ##e0e0e0; border-radius: 8px;">
                                            <tr>
                                                <td style="padding: 24px 48px;">
                                                    <p style="margin: 0; color: ##212121; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; text-align: center;">
                                                        #args.code#
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Expiration Notice -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px; background-color: ##fff5f5; border-left: 4px solid ##fc8181; border-radius: 4px;">
                                        <p style="margin: 0; color: ##742a2a; font-size: 14px;">
                                            This code will expire in <strong>#args.verificationLifeSpan# minutes</strong> at <strong>#dateTimeFormat(args.expires, "mmm dd, yyyy h:nn tt")# UTC</strong>.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0; color: ##718096; font-size: 14px;">
                                If you didn't create an account with SpendingTracker, please disregard this email.
                            </p>
                        </td>
                    </tr>                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
</cfoutput>