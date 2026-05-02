import { useEffect, useState } from "react";

function getMsUntilNextMinute(date: Date) {
	return 60000 - (date.getSeconds() * 1000 + date.getMilliseconds());
}

export function useCurrentMinute() {
	const [currentTime, setCurrentTime] = useState(() => new Date());

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval> | undefined;

		const timeoutId = setTimeout(() => {
			setCurrentTime(new Date());
			intervalId = setInterval(() => {
				setCurrentTime(new Date());
			}, 60000);
		}, getMsUntilNextMinute(new Date()));

		return () => {
			clearTimeout(timeoutId);
			if (intervalId) {
				clearInterval(intervalId);
			}
		};
	}, []);

	return currentTime;
}
