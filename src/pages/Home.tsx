import React from "react";
import StandingsTab from "../components/dashboard/StandingsTab";
import RangeFilter from "../components/dashboard/RangeFilter";

export default function Home() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8f0]">
            <RangeFilter />
            <StandingsTab />
        </div>
    )
}