import {Stack} from 'expo-router';
import {ThemeProvider, useCineHuntTheme} from '../cinehunt/theme';

// Nền của navigator theo theme để không nháy tối khi đang ở Light (và ngược lại).
function ThemedStack(){
  const {C}=useCineHuntTheme();
  return <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.bg}}}/>;
}
export default function RootLayout(){
  return <ThemeProvider><ThemedStack/></ThemeProvider>;
}
