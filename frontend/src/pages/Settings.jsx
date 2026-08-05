import { useState } from 'react';
import HotelProfileForm from '../components/settings/HotelProfileForm.jsx';
import RoomTypesManager from '../components/settings/RoomTypesManager.jsx';
import RoomsManager from '../components/settings/RoomsManager.jsx';
import StaffManager from '../components/settings/StaffManager.jsx';

export default function Settings() {
  const [roomTypes, setRoomTypes] = useState([]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-ink-700">Hotel profile, currency, rooms and staff.</p>
      </div>

      <HotelProfileForm />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RoomTypesManager onChange={setRoomTypes} />
        <RoomsManager roomTypes={roomTypes} />
      </div>

      <StaffManager />
    </div>
  );
}
