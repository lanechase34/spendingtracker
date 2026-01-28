import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import CardContent from '@mui/material/CardContent';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import useUserContext from 'hooks/useUserContext';
import { ReactNode } from 'react';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import GitHubIcon from '@mui/icons-material/GitHub';
import DescriptionIcon from '@mui/icons-material/Description';
import LoginDialog from 'user/LoginDialog';
import LoginDialogButton from 'user/LoginDialogButton';
import RegisterDialog from 'user/RegisterDialog';
import VerifyDialog from 'user/VerifyDialog';
import RegisterDialogButton from 'user/RegisterDialogButton';
import { Link } from 'react-router-dom';
import Masonry from '@mui/lab/Masonry';
import useAuthContext from 'hooks/useAuthContext';

const infoCardSx = {
    borderRadius: 3,
    bgcolor: 'background.default',
    transition: 'border-color 0.2s ease, transform 0.2s ease',
    '&:hover': {
        borderColor: 'primary.main',
        transform: 'translateY(-2px)',
    },
};

const showcaseSurfaceSx = {
    mt: 6,
    p: { xs: 3, md: 6 },
    borderRadius: 4,
    bgcolor: 'background.default',
    border: '1px solid',
    borderColor: 'divider',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))',
        pointerEvents: 'none',
    },
};

interface FeatureCardProps {
    icon: ReactNode;
    title: string;
    description: string;
}

/**
 * Card to showcase feature with brief description of feature
 * @icon MUI Icon
 * @title
 * @description
 */
function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <Grid size={{ xs: 12, md: 4 }}>
            <Card
                variant="outlined"
                sx={{
                    height: '100%',
                    ...infoCardSx,
                }}
            >
                <CardContent>
                    <Box sx={{ mb: 2, color: 'primary.main' }}>{icon}</Box>
                    <Typography variant="h6" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {description}
                    </Typography>
                </CardContent>
            </Card>
        </Grid>
    );
}

interface FeatureShowCaseProps {
    title: string;
    description: string;
    media: string;
    reverse?: boolean;
}

/**
 * Show a screenshot of the application with accompanying description, title
 */
function FeatureShowcase({ title, description, media, reverse = false }: FeatureShowCaseProps) {
    return (
        <Box sx={showcaseSurfaceSx}>
            <Grid container spacing={4} direction={reverse ? 'row-reverse' : 'row'} alignItems="center">
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h5" gutterBottom>
                        {title}
                    </Typography>
                    <Typography color="text.secondary">{description}</Typography>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box
                        component="img"
                        src={media}
                        alt={title}
                        loading="lazy"
                        sx={{ width: '100%', borderRadius: 3, boxShadow: 4 }}
                    />
                </Grid>
            </Grid>
        </Box>
    );
}

interface TechBulletProps {
    title: string;
    text: string;
}

/**
 * Bullet for technical details
 */
function TechBullet({ title, text }: TechBulletProps) {
    return (
        <Grid size={{ xs: 12, lg: 6 }}>
            <Paper
                variant="outlined"
                sx={{
                    p: 3,
                    ...infoCardSx,
                }}
            >
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {title}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                    {text}
                </Typography>
            </Paper>
        </Grid>
    );
}

export default function About() {
    const { isInitializing } = useAuthContext();
    const { isAuthorized, hasRole } = useUserContext();
    const boxPadding = 6;

    return (
        <>
            <Container maxWidth="lg">
                {/* Hero */}
                <Box sx={{ py: 10, textAlign: 'center' }}>
                    <Typography variant="h3" gutterBottom>
                        SpendingTracker
                    </Typography>

                    <Typography variant="h6" color="text.secondary" sx={{ mb: 5, maxWidth: 700, mx: 'auto' }}>
                        A full-stack expense and subscription tracking platform designed to surface spending insights,
                        trends, and real-world financial clarity.
                    </Typography>

                    {isAuthorized() ? (
                        <Stack direction="row" spacing={2} justifyContent="center">
                            <Button variant="contained" size="large" component={Link} to={'/dashboard'}>
                                Go to Dashboard
                            </Button>
                            {hasRole('ADMIN') && (
                                <Button variant="contained" size="large" component={Link} to={'/admin'}>
                                    Admin Dashboard
                                </Button>
                            )}
                        </Stack>
                    ) : (
                        <Stack direction="row" spacing={2} justifyContent="center">
                            <RegisterDialogButton
                                size="large"
                                disabled={isInitializing()}
                                text="Get Started"
                                variant="contained"
                            />
                            <LoginDialogButton disabled={isInitializing()} size="large" />
                        </Stack>
                    )}
                </Box>

                {/* Feature Cards */}
                <Box sx={{ py: boxPadding }}>
                    <Typography variant="h4" align="center" gutterBottom>
                        Key Features
                    </Typography>
                    <Divider />

                    <Grid container spacing={4} sx={{ mt: 6 }}>
                        <FeatureCard
                            icon={<TrendingUpIcon />}
                            title="Expense Tracking & Trends"
                            description="Track expenses and visualize weekly trends over custom date ranges."
                        />
                        <FeatureCard
                            icon={<CalendarMonthIcon />}
                            title="Subscription Management"
                            description="Automatically track recurring weekly or monthly subscriptions with future cost visibility."
                        />
                        <FeatureCard
                            icon={<CategoryIcon />}
                            title="Category Breakdown"
                            description="Clear summaries and charts showing where your money goes."
                        />
                        <FeatureCard
                            icon={<AccountBalanceIcon />}
                            title="Net Income Insights"
                            description="Combine income and expenses to understand net financial performance."
                        />
                        <FeatureCard
                            icon={<UploadFileIcon />}
                            title="CSV Bulk Import"
                            description="Efficiently import large datasets using a validated and resilient CSV ingestion pipeline."
                        />
                    </Grid>
                </Box>

                {/* Feature Showcases */}
                <Box sx={{ py: boxPadding }}>
                    <Typography variant="h4" align="center" gutterBottom>
                        Feature Highlights
                    </Typography>
                    <Divider />

                    <FeatureShowcase
                        title="Expense Tracking"
                        description="A high-performance expense table supports sorting, pagination, search, receipt viewing, and dynamic totals—built to handle real-world datasets."
                        media={`${import.meta.env.BASE_URL}/screenshots/expense_widget.webp`}
                    />

                    <FeatureShowcase
                        title="Category Breakdown"
                        description="Visual breakdown by category of where your money is going."
                        media={`${import.meta.env.BASE_URL}/screenshots/category_widget.webp`}
                        reverse
                    />

                    <FeatureShowcase
                        title="Weekly Trends"
                        description="Visualize category and spending trends over time using dynamic date ranges."
                        media={`${import.meta.env.BASE_URL}/screenshots/stacked_widget.webp`}
                    />

                    <FeatureShowcase
                        title="Subscription Management"
                        description="Automatically recurring subscriptions with weekly or monthly billing cycles."
                        media={`${import.meta.env.BASE_URL}/screenshots/subscription_widget.webp`}
                        reverse
                    />

                    <FeatureShowcase
                        title="CSV Bulk Import"
                        description="Bulk import expenses using a CSV with parsing, validation, transformation, and error handling."
                        media={`${import.meta.env.BASE_URL}/gifs/csv_import.gif`}
                    />
                </Box>

                {/* Technical Overview */}
                <Box sx={{ py: boxPadding }}>
                    <Typography variant="h4" align="center" gutterBottom>
                        Technical Overview
                    </Typography>
                    <Divider />

                    <Masonry columns={{ xs: 1, lg: 2 }} spacing={3} sx={{ maxWidth: 900, mx: 'auto', mt: 4 }}>
                        <TechBullet
                            title="Frontend"
                            text="React, TypeScript, React Router, and Material UI with a composable context-provider architecture."
                        />
                        <TechBullet
                            title="State Management"
                            text="Context-based state with custom hooks for authentication, users, expenses, subscriptions, and date ranges."
                        />
                        <TechBullet
                            title="Authentication & Authorization"
                            text="JWT-based authentication with role-protected routes and conditional UI rendering."
                        />
                        <TechBullet
                            title="Backend"
                            text="ColdBox and Lucee power a feature-rich REST API focused on performance, validation, and extensibility."
                        />
                        <TechBullet
                            title="Data Import"
                            text="CSV ingestion pipeline with validation, transformation, and bulk persistence."
                        />
                        <TechBullet
                            title="Validation"
                            text="Zod provides runtime validation on the frontend, while CBValidation enforces consistency and safety on the backend."
                        />
                        <TechBullet
                            title="Database"
                            text="PostgresSQL servers as the datasource for performance, JSON data types, and relational database."
                        />
                        <TechBullet
                            title="Web Server"
                            text="The backend runs on CommandBox, which provides local and production server orchestration, environment configuration, and acts as the embedded web server."
                        />
                        <TechBullet
                            title="Infrastructure & Hosting"
                            text="The application is hosted on an AWS Lightsail Ubuntu instance and deployed behind Cloudflare for DNS management, TLS termination, and caching."
                        />
                        <TechBullet
                            title="Reliability & Auditing"
                            text="The backend includes structured request logging, centralized error handling, and audit-friendly metadata to improve debuggability, traceability, and long-term maintainability."
                        />
                        <TechBullet
                            title="Testing & Quality"
                            text="Comprehensive test coverage using Jest for frontend unit/integration tests and TestBox for backend API testing."
                        />
                    </Masonry>
                </Box>

                {/* Links */}
                <Box sx={{ py: boxPadding, textAlign: 'center' }}>
                    <Typography variant="h4" gutterBottom>
                        Code & Documentation
                    </Typography>
                    <Divider />

                    <Stack direction="row" spacing={2} justifyContent="center" sx={{ my: 4 }}>
                        <Button
                            variant="outlined"
                            startIcon={<GitHubIcon />}
                            href="https://github.com/lanechase34/spendingtracker"
                            target="_blank"
                        >
                            GitHub Repository
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<DescriptionIcon />}
                            href="apiDocsRepoLink"
                            target="_blank"
                            sx={{ display: 'none' }}
                        >
                            API Documentation
                        </Button>
                    </Stack>
                </Box>
            </Container>

            <LoginDialog />

            <RegisterDialog />

            <VerifyDialog />
        </>
    );
}
