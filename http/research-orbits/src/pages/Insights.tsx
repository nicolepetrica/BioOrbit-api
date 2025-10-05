import React from "react";
import Navbar from "./components/Navbar";
import StakeholderInsights from "./components/StakeholderInsights";
import Graphs from "./components/Graphs";

const Insights = () => {

    return (
         <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
            <Navbar />
      
            {/* Removed `w-screen` to prevent horizontal scrollbars */}
            <section className="w-screen relative overflow-hidden px-[40px] pt-10 pb-16">
              {/* Added a max-width container for consistent page width */}
              <div className="mx-auto max-w-[1800px]">
                
                {/* --- NEW HEADER SECTION --- */}
                <header className="text-center md:text-left">
                  <h1 className="font-extrabold tracking-tight text-[clamp(24px,4.8vw,56px)]">
                    Data Insights & Forecasts
                  </h1>
                  <p className="mx-auto md:mx-0 mt-4 max-w-[900px] text-white/80 text-[clamp(14px,1.3vw,18px)]">
                    Explore research trends from different stakeholder perspectives. Analyze historical data, view AI-powered forecasts, and assess research maturity across key mission domains.
                  </p>
                </header>
                {/* --- END OF HEADER --- */}
                <div className="mt-8">
                <Graphs />
                </div>
                {/* Added a wrapper with vertical margin for spacing */}
                <div className="my-16">
                  {/* Pass the papers prop to StakeholderInsights */}
                  <StakeholderInsights />
                </div>

                <footer id="footer" className="mt-16 pb-16 text-center text-white/60 text-[clamp(11px,0.9vw,13px)]">
                    © {new Date().getFullYear()} Research Orbits — Space Biology Research
                </footer>
              </div>
            </section>
          </main>
    );
};

export default Insights;