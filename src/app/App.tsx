import { CatalogProvider } from '../features/catalog/CatalogProvider';
import { WalletProvider } from '../features/wallet/WalletProvider';
import { LocaleProvider } from '../i18n/LocaleProvider';
import { Layout } from './Layout';
import { ThemeProvider } from './ThemeProvider';

export function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <WalletProvider>
          <CatalogProvider>
            <Layout />
          </CatalogProvider>
        </WalletProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
