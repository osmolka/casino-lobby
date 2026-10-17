import { WalletProvider } from '../features/wallet/WalletProvider';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { Layout } from './Layout';

export function App() {
  return (
    <LocaleProvider>
      <WalletProvider>
        <Layout />
      </WalletProvider>
    </LocaleProvider>
  );
}
