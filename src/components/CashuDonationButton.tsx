export const CashuDonationButton = () => {
  const lightningAddress = "npub1ff5x2ah4tnmad93mfwpa8trklwy8ttctn5x2q8zzlm33xlr8mruq3l7q4q@npub.cash";

  return (
    <a
      href={`lightning:${lightningAddress}`}
      title="Buy me a coffee ☕"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#d97706',
        color: '#fff',
        fontSize: '1.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        zIndex: 50,
        textDecoration: 'none',
        transition: 'transform 0.2s, background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#b45309';
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#d97706';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      ☕
    </a>
  );
};
