export const CashuDonationButton = () => {
  const lightningAddress = "npub1ff5x2ah4tnmad93mfwpa8trklwy8ttctn5x2q8zzlm33xlr8mruq3l7q4q@npub.cash";

  return (
    <a
      href={`lightning:${lightningAddress}`}
      className="fixed bottom-6 right-6 bg-amber-600 hover:bg-amber-700 text-white text-3xl w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
      title="Buy me a coffee ☕"
    >
      ☕
    </a>
  );
};
