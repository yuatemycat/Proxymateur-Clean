import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';
import AccountCard from './AccountCard';
import Mascot from '../common/Mascot';

interface AccountGridProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onViewDevice: (accountId: string) => void;
    onViewDetails: (accountId: string) => void;
    onExport: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onToggleProxy: (accountId: string) => void;
    onWarmup?: (accountId: string) => void;
    onUpdateLabel?: (accountId: string, label: string) => void;
    onViewError: (accountId: string) => void;
    quotaWindow?: '5h' | 'weekly';
    maskEmails?: boolean;
}


function AccountGrid({ accounts, selectedIds, refreshingIds, onToggleSelect, currentAccountId, switchingAccountId, onSwitch, onRefresh, onViewDetails, onExport, onDelete, onToggleProxy, onViewDevice, onWarmup, onUpdateLabel, onViewError, quotaWindow, maskEmails = true }: AccountGridProps) {
    const { t } = useTranslation();
    if (accounts.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 border-2 border-dashed border-base-content/40 p-12 text-center">
                <Mascot size={48} className="text-base-content/40" face="var(--color-base-100)" />
                <p className="text-base-content/70 font-black uppercase tracking-[0.18em]">{t('accounts.empty.title')}</p>
                <p className="text-sm text-base-content/50">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accounts.map((account) => (
                <AccountCard
                    key={account.id}
                    account={account}
                    selected={selectedIds.has(account.id)}
                    isRefreshing={refreshingIds.has(account.id)}
                    onSelect={() => onToggleSelect(account.id)}
                    isCurrent={account.id === currentAccountId}
                    isSwitching={account.id === switchingAccountId}
                    onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                    onRefresh={() => onRefresh(account.id)}
                    onViewDevice={() => onViewDevice(account.id)}
                    onViewDetails={() => onViewDetails(account.id)}
                    onExport={() => onExport(account.id)}
                    onDelete={() => onDelete(account.id)}
                    onToggleProxy={() => onToggleProxy(account.id)}
                    onWarmup={onWarmup ? () => onWarmup(account.id) : undefined}
                    onUpdateLabel={onUpdateLabel ? (label: string) => onUpdateLabel(account.id, label) : undefined}
                    onViewError={() => onViewError(account.id)}
                    quotaWindow={quotaWindow}
                    maskEmails={maskEmails}
                />
            ))}
        </div>
    );
}

export default AccountGrid;
