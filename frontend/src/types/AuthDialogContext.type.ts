export interface AuthDialogContextType {
    loginDialogOpen: boolean;
    openLoginDialog: () => void;
    closeLoginDialog: () => void;

    registerDialogOpen: boolean;
    openRegisterDialog: () => void;
    closeRegisterDialog: () => void;

    verifyDialogOpen: boolean;
    openVerifyDialog: () => void;
    closeVerifyDialog: () => void;
}
