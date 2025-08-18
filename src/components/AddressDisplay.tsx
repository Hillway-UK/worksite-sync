import React from 'react';

interface AddressDisplayProps {
  address?: string; // Legacy field
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  multiline?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  address_line_1,
  address_line_2,
  city,
  county,
  postcode,
  multiline = false,
  className = ""
}: AddressDisplayProps) {
  // Use structured address if available, otherwise fall back to legacy
  const hasStructuredAddress = address_line_1 || city || postcode;
  
  if (hasStructuredAddress) {
    const addressParts = [
      address_line_1,
      address_line_2,
      city,
      county,
      postcode
    ].filter(Boolean);

    if (multiline) {
      return (
        <div className={className}>
          {address_line_1 && <div>{address_line_1}</div>}
          {address_line_2 && <div className="text-muted-foreground">{address_line_2}</div>}
          <div>
            {[city, county].filter(Boolean).join(', ')}
          </div>
          {postcode && (
            <div className="font-mono text-sm font-medium">{postcode}</div>
          )}
        </div>
      );
    }

    return (
      <span className={className}>
        {addressParts.join(', ')}
      </span>
    );
  }

  // Fall back to legacy address
  if (address) {
    if (multiline) {
      return (
        <div className={className}>
          {address.split(', ').map((part, index) => (
            <div key={index}>{part}</div>
          ))}
        </div>
      );
    }

    return <span className={className}>{address}</span>;
  }

  return <span className={`text-muted-foreground ${className}`}>No address available</span>;
}