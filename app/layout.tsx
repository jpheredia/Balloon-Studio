import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Balloon Studio · Inspección de planos', description: 'Marca zonas en PDF, ordena balloons y exporta recortes con XML.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
