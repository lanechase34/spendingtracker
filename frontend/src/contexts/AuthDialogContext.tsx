import type { ReactNode } from 'react';
import { createContext, useCallback, useMemo,useState } from 'react';
import type { AuthDialogContextType } from 'types/AuthDialogContext.type';

export const AuthDialogContext = createContext<AuthDialogContextType | undefined>(undefined);

/**
 * Stores the current visibility and state for the following Dialogs
 * related to the auth circuit:
 *
 * LoginDialog
 * RegisterDialog
 * VerifyDialog
 *
 */
export const AuthDialogContextProvider = ({ children }: { children: ReactNode }) => {
    /**
     * Login Dialog State
     */
    const [loginDialogOpen, setLoginDialogOpen] = useState<boolean>(false);
    const openLoginDialog = useCallback(() => setLoginDialogOpen(true), []);
    const closeLoginDialog = useCallback(() => setLoginDialogOpen(false), []);

    /**
     * Register Dialog State
     */
    const [registerDialogOpen, setRegisterDialogOpen] = useState<boolean>(false);
    const openRegisterDialog = useCallback(() => setRegisterDialogOpen(true), []);
    const closeRegisterDialog = useCallback(() => setRegisterDialogOpen(false), []);

    /**
     * Verify Dialog State
     */
    const [verifyDialogOpen, setVerifyDialogOpen] = useState<boolean>(false);
    const openVerifyDialog = useCallback(() => setVerifyDialogOpen(true), []);
    const closeVerifyDialog = useCallback(() => setVerifyDialogOpen(false), []);

    const value: AuthDialogContextType = useMemo(
        () => ({
            loginDialogOpen,
            openLoginDialog,
            closeLoginDialog,
            registerDialogOpen,
            openRegisterDialog,
            closeRegisterDialog,
            verifyDialogOpen,
            openVerifyDialog,
            closeVerifyDialog,
        }),
        [
            loginDialogOpen,
            registerDialogOpen,
            verifyDialogOpen,
            openLoginDialog,
            closeLoginDialog,
            openRegisterDialog,
            closeRegisterDialog,
            openVerifyDialog,
            closeVerifyDialog,
        ]
    );

    return <AuthDialogContext value={value}>{children}</AuthDialogContext>;
};
