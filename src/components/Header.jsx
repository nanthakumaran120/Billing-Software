import React from 'react';
import { PhoneCall } from 'lucide-react';

const DeskPhoneIcon = ({ size = 10, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M448 358.4V256c0-17.7-14.3-32-32-32H96c-17.7 0-32 14.3-32 32v102.4c-37.3 10.4-64 45.3-64 86.4C0 491 38.2 512 64 512h384c25.8 0 64-21 64-67.2 0-41.1-26.7-76-64-86.4zM224 384h64v32h-64v-32zm-64 0h32v32h-32v-32zm0-64h32v32h-32v-32zm64 0h64v32h-64v-32zm128 64h-32v-32h32v32zm0-64h-32v-32h32v32zm-256 64h-32v-32h32v32zm0-64h-32v-32h32v32zM128 192h256c17.7 0 32-14.3 32-32V96c0-53-43-96-96-96H192c-53 0-96 43-96 96v64c0 17.7 14.3 32 32 32z" />
    </svg>
);

const Header = () => {
    return (
        <header className="flex flex-col relative w-full">
            {/* Perumal Logo */}
            <div
                className="absolute flex items-center justify-center bg-transparent"
                style={{ top: '12px', left: '24px', width: '90px', height: '100px', mixBlendMode: 'multiply' }}
            >
                <img
                    src="/assets/perumal_logo.png"
                    alt="Perumal Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
            </div>

            {/* Proprietor & Contact Details */}
            <div
                className="absolute text-left text-[9px] font-medium text-gray-500 leading-tight no-print flex flex-col gap-1.5"
                style={{ top: '6px', right: '16px' }}
            >
                <p>Prop: Ayyanar.M</p>
                <p className="flex justify-start items-center gap-2"><PhoneCall size={10} /> 9944154414</p>
                <p className="flex justify-start items-center gap-2"><PhoneCall size={10} /> 7904216380</p>
                <p className="flex justify-start items-center gap-2"><DeskPhoneIcon size={10} /> 04287-224935</p>
            </div>
            {/* Print version for fixed positioning */}
            <div
                className="hidden print:flex absolute text-left text-[9px] font-medium text-gray-500 leading-tight flex-col gap-1.5"
                style={{ top: '6px', right: '16px' }}
            >
                <p>Prop: Ayyanar.M</p>
                <p className="flex justify-start items-center gap-2"><PhoneCall size={10} /> 9944154414</p>
                <p className="flex justify-start items-center gap-2"><PhoneCall size={10} /> 7904216380</p>
                <p className="flex justify-start items-center gap-2"><DeskPhoneIcon size={10} /> 04287-224935</p>
            </div>

            <div className="text-center pt-2 pb-2">
                <h3 className="text-xs font-bold uppercase text-gray-500 mb-1">Tax Invoice / Labour Receipt</h3>
                <h1 className="text-4xl font-bold text-blue-600 mb-1">SRINIVASA DYEING</h1>
                <p className="font-bold text-gray-600 uppercase text-xs tracking-widest">Dyeing & Cloth Merchant</p>
                <div className="font-bold mt-2 text-gray-800 uppercase tracking-widest text-sm">
                    <span>GSTIN: 33AKQPA9652A1ZD</span>
                </div>
            </div>

            <div className="flex flex-col text-sm pb-2 px-2 items-center text-center border-b border-gray-400">
                <p>22, Kattur Road, C.S. Puram P.O., 637 401</p>
                <p>Rasipuram Tk, Namakkal Dt, Tamil Nadu</p>
            </div>
        </header>
    );
};

export default Header;
