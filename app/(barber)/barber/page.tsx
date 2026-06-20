import Nav from "@/components/barber/Nav";
import Hero from "@/components/barber/Hero";
import Marquee from "@/components/barber/Marquee";
import Services from "@/components/barber/Services";
import Team from "@/components/barber/Team";
import Gallery from "@/components/barber/Gallery";
import Booking from "@/components/barber/Booking";
import Reviews from "@/components/barber/Reviews";
import VisitUs from "@/components/barber/VisitUs";
import Footer from "@/components/barber/Footer";
import { SectionHead } from "@/components/barber/Section";

export default function BarberPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Services />
        <Team />
        <Gallery />

        <section id="book" className="scroll-mt-20 bg-coal-soft/40">
          <div className="mx-auto max-w-editorial px-6 py-24 lg:px-10 lg:py-32">
            <SectionHead
              eyebrow="Reserve"
              title="Book Your Chair"
              intro="Four quick steps. No account, no hassle — lock in your barber and your time in under a minute."
            />
            <div className="mt-14">
              <Booking />
            </div>
          </div>
        </section>

        <Reviews />
        <VisitUs />
      </main>
      <Footer />
    </>
  );
}
