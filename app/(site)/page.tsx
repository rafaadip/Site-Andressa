import { Hero } from '@/components/site/Hero';
import { Credenciais } from '@/components/site/Credenciais';
import { Sobre } from '@/components/site/Sobre';
import { Atendimento } from '@/components/site/Atendimento';
import { Nutrologia } from '@/components/site/Nutrologia';
import { ComoAgendar } from '@/components/site/ComoAgendar';
import { Faq } from '@/components/site/Faq';
import { Contato } from '@/components/site/Contato';
import { BarraAgendarMobile } from '@/components/site/BarraAgendarMobile';
import { JsonLd } from '@/components/site/JsonLd';
import { jsonLdProfissional, jsonLdFaq } from '@/lib/seo';

export default function Home() {
  return (
    <>
      <JsonLd dados={jsonLdProfissional()} />
      <JsonLd dados={jsonLdFaq()} />
      <Hero />
      <Credenciais />
      <Sobre />
      <Atendimento />
      <Nutrologia />
      <ComoAgendar />
      <Faq />
      <Contato />
      <BarraAgendarMobile />
    </>
  );
}
