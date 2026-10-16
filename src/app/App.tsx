import { LocaleProvider } from '../i18n/LocaleProvider';
import { Layout } from './Layout';

export function App() {
  return (
    <LocaleProvider>
      <Layout />
    </LocaleProvider>
  );
}
