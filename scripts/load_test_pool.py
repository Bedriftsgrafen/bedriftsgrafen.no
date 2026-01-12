import asyncio
import httpx
import time
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FILTER_URL = "http://localhost:8000/v1/companies"
CONCURRENT_REQUESTS = 100


async def fetch_url(client, i):
    start = time.time()
    try:
        # Request page 1 of companies - hits DB connection pool
        response = await client.get(FILTER_URL, params={"limit": 10})
        duration = time.time() - start
        return response.status_code, duration, response.text
    except Exception as e:
        return 0, time.time() - start, str(e)


async def run_load_test():
    print(f"Starting load test with {CONCURRENT_REQUESTS} concurrent requests...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_url(client, i) for i in range(CONCURRENT_REQUESTS)]
        results = await asyncio.gather(*tasks)

    success_count = sum(1 for r in results if r[0] == 200)
    failed_count = sum(1 for r in results if r[0] != 200)
    times = [r[1] for r in results]
    avg_time = sum(times) / len(times)
    max_time = max(times)

    print("\nResults:")
    print(f"Total Requests: {len(results)}")
    print(f"Success: {success_count}")
    print(f"Failed: {failed_count}")
    print(f"Avg Time: {avg_time:.4f}s")
    print(f"Max Time: {max_time:.4f}s")

    if failed_count > 0:
        print("\nErrors (First 5):")
        shown = 0
        for r in results:
            if r[0] != 200:
                print(f"Status: {r[0]}, Body: {r[2][:200]}")
                shown += 1
                if shown >= 5:
                    break


if __name__ == "__main__":
    asyncio.run(run_load_test())
