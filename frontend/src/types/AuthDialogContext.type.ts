export interface AuthDialogContextType {
    loginDialogOpen: boolean;
    openLoginDialog: () => void;
    closeLoginDialog: () => void;

    verify2FADialogOpen: boolean;
    openVerify2FADialog: () => void;
    closeVerify2FADialog: () => void;

    registerDialogOpen: boolean;
    openRegisterDialog: () => void;
    closeRegisterDialog: () => void;

    verifyDialogOpen: boolean;
    openVerifyDialog: () => void;
    closeVerifyDialog: () => void;
}
