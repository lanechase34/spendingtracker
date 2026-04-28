import ArticleIcon from '@mui/icons-material/Article';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LogLine from 'admin/components/LogLine';
import useAuthFetch from 'hooks/useAuthFetch';
import { useCallback, useEffect, useState } from 'react';
import { APIError } from 'utils/apiError';
import { API_BASE_URL } from 'utils/constants';
import { formatBytes } from 'utils/fileReader';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const LogFileSchema = z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    dateLastModified: z.string(),
});

const LogContentSchema = z.object({
    filename: z.string(),
    lines: z.array(z.string()),
    count: z.number(),
    filtered: z.boolean(),
});

const LogListResponseSchema = validateAPIResponse(z.array(LogFileSchema));
const LogContentResponseSchema = validateAPIResponse(LogContentSchema);

export type LogFile = z.infer<typeof LogFileSchema>;
export type LogContent = z.infer<typeof LogContentSchema>;

const DEFAULT_LINES = 200;
const LINE_OPTIONS = [100, 200, 500, 1000, 2000];

export default function ServerLogs() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const authFetch = useAuthFetch();

    // Log list state
    const [logFiles, setLogFiles] = useState<LogFile[]>([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [filesError, setFilesError] = useState<string | null>(null);

    // Log content state
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [lines, setLines] = useState<string[]>([]);
    const [linesToLoad, setLinesToLoad] = useState(DEFAULT_LINES);
    const [contentLoading, setContentLoading] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [filtered, setFiltered] = useState(false);

    // Search
    const [searchInput, setSearchInput] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');

    // Fetch log content
    const fetchContent = useCallback(
        async (filename: string, linesToLoad: number, search: string, signal?: AbortSignal) => {
            setContentLoading(true);
            setContentError(null);

            try {
                const params = new URLSearchParams({ lines: String(linesToLoad) });
                if (search) params.set('search', search);

                const response = await authFetch({
                    url: `${API_BASE_URL}/admin/logs/${encodeURIComponent(filename)}?${params}`,
                    signal,
                });

                if (!response) {
                    throw new APIError('Invalid state.', 500);
                }

                // Validate the response data
                const json = await safeJson(response);
                const parsed = LogContentResponseSchema.safeParse(json);

                if (!parsed.success) {
                    throw new APIError('Invalid response format', response?.status ?? 0);
                }

                if (parsed.data.error || !response?.ok) {
                    throw new APIError('Failed to load log content', response?.status ?? 0);
                }

                const { lines, filtered } = parsed.data.data;

                setLines(lines);
                setFiltered(filtered);
            } catch (e: unknown) {
                if (signal?.aborted) return;
                setContentError(e instanceof APIError ? e.message : 'Failed to load log content');
            } finally {
                if (!signal?.aborted) setContentLoading(false);
            }
        },
        [authFetch]
    );

    // Load log list on mount
    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setFilesLoading(true);
            setFilesError(null);

            try {
                const response = await authFetch({
                    url: `${API_BASE_URL}/admin/logs`,
                    signal: controller.signal,
                });

                if (!response) throw new APIError('Invalid state.', 500);

                const json = await safeJson(response);
                const parsed = LogListResponseSchema.safeParse(json);

                if (!parsed.success) throw new APIError('Invalid response format', response.status);
                if (parsed.data.error || !response.ok) throw new APIError('Failed to load logs', response.status);

                setLogFiles(parsed.data.data);
            } catch (e: unknown) {
                if (controller.signal.aborted) return;
                setFilesError(e instanceof APIError ? e.message : 'Failed to load logs');
            } finally {
                if (!controller.signal.aborted) setFilesLoading(false);
            }
        };

        void load();

        // Cleanup state on unmount
        return () => {
            controller.abort();
            setActiveFile(null);
            setLines([]);
            setFiltered(false);
            setSearchInput('');
            setAppliedSearch('');
            setContentError(null);
            setLinesToLoad(DEFAULT_LINES);
        };
    }, [authFetch]);

    // File picker
    const handleSelectFile = useCallback(
        (filename: string) => {
            setActiveFile(filename);
            setLines([]);
            setSearchInput('');
            setAppliedSearch('');
            void fetchContent(filename, linesToLoad, '');
        },
        [fetchContent, linesToLoad]
    );

    // Search
    const handleSearch = () => {
        if (!activeFile) return;
        setAppliedSearch(searchInput);
        void fetchContent(activeFile, linesToLoad, searchInput);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setAppliedSearch('');
        if (activeFile) void fetchContent(activeFile, linesToLoad, '');
    };

    const handleRefresh = () => {
        if (activeFile) void fetchContent(activeFile, linesToLoad, appliedSearch);
    };

    const activeMeta = logFiles.find((f) => f.name === activeFile);

    return (
        <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/*  File list sidebar  */}
            <Box
                sx={{
                    width: 220,
                    flexShrink: 0,
                    borderRight: 1,
                    borderColor: 'divider',
                    overflowY: 'auto',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}
                    >
                        Log Files
                    </Typography>
                </Box>

                {filesLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                {filesError && (
                    <Alert severity="error" sx={{ m: 1 }}>
                        {filesError}
                    </Alert>
                )}

                {!filesLoading && !filesError && (
                    <List dense disablePadding sx={{ flex: 1 }}>
                        {logFiles.map((file) => {
                            const isActive = file.name === activeFile;
                            const isEmpty = file.size === 0;

                            return (
                                <ListItemButton
                                    key={file.name}
                                    selected={isActive}
                                    disabled={isEmpty}
                                    onClick={() => !isEmpty && handleSelectFile(file.name)}
                                    sx={{ py: 0.75, px: 1.5, opacity: isEmpty ? 0.45 : 1 }}
                                >
                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                        <ArticleIcon
                                            fontSize="small"
                                            sx={{
                                                color: isActive ? 'primary.main' : 'text.secondary',
                                                fontSize: '1rem',
                                            }}
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={file.name}
                                        secondary={formatBytes(file.size)}
                                        slotProps={{
                                            primary: {
                                                sx: {
                                                    fontSize: '0.8rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                },
                                            },
                                            secondary: { sx: { fontSize: '0.7rem' } },
                                        }}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                )}
            </Box>

            {/*  Log viewer pane  */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Toolbar */}
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                        flexShrink: 0,
                        flexWrap: 'wrap',
                    }}
                >
                    {activeFile ? (
                        <>
                            <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                                {activeFile}
                            </Typography>
                            {activeMeta && (
                                <Chip label={formatBytes(activeMeta.size)} size="small" variant="outlined" />
                            )}
                            <Chip
                                label={filtered ? `${lines.length} matched` : `${lines.length} lines`}
                                size="small"
                                color={filtered ? 'warning' : 'default'}
                                variant={filtered ? 'filled' : 'outlined'}
                            />
                        </>
                    ) : (
                        <Typography variant="subtitle2" color="text.secondary">
                            Select a log file
                        </Typography>
                    )}

                    <Box sx={{ flex: 1 }} />

                    <TextField
                        size="small"
                        placeholder="Search lines…"
                        value={searchInput}
                        disabled={!activeFile}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        sx={{ width: 220 }}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <>
                                        {appliedSearch ? (
                                            <InputAdornment position="end">
                                                <ClearIcon
                                                    fontSize="small"
                                                    sx={{ cursor: 'pointer' }}
                                                    onClick={handleClearSearch}
                                                />
                                            </InputAdornment>
                                        ) : null}
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                disabled={!activeFile || !searchInput}
                                                onClick={handleSearch}
                                            >
                                                <SearchIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    </>
                                ),
                            },
                        }}
                    />

                    {/* Lines dropdown */}
                    <TextField
                        select
                        size="small"
                        value={linesToLoad}
                        disabled={!activeFile}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            setLinesToLoad(next);
                            if (activeFile) void fetchContent(activeFile, next, appliedSearch);
                        }}
                        sx={{ width: 130 }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Typography
                                            sx={{ fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}
                                        >
                                            Lines:
                                        </Typography>
                                    </InputAdornment>
                                ),
                            },
                        }}
                    >
                        {LINE_OPTIONS.map((n) => (
                            <MenuItem key={n} value={n}>
                                {n}
                            </MenuItem>
                        ))}
                    </TextField>

                    <Divider orientation="vertical" flexItem />

                    <Tooltip title="Refresh">
                        <span>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={!activeFile || contentLoading}
                                onClick={handleRefresh}
                                startIcon={<RefreshIcon fontSize="small" />}
                            >
                                Refresh
                            </Button>
                        </span>
                    </Tooltip>
                </Box>

                {/* Log output */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        px: 2,
                        py: 1.5,
                        bgcolor: isDark ? '#0f172a' : '#f8fafc',
                    }}
                >
                    {contentLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress size={28} />
                        </Box>
                    )}

                    {contentError && !contentLoading && <Alert severity="error">{contentError}</Alert>}

                    {!contentLoading && !contentError && lines.length === 0 && activeFile && (
                        <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            No lines to display{appliedSearch ? ' — try a different search term' : ''}.
                        </Typography>
                    )}

                    {!contentLoading && !activeFile && (
                        <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            Select a log file from the sidebar.
                        </Typography>
                    )}

                    {!contentLoading &&
                        activeFile &&
                        lines.map((line, i) => (
                            // eslint-disable-next-line @eslint-react/no-array-index-key
                            <LogLine key={`${i}-${line}`} line={line} search={appliedSearch} isDark={isDark} />
                        ))}
                </Box>
            </Box>
        </Box>
    );
}
