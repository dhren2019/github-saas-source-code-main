'use client'
import React from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

const SearchBar = () => {
    return (
        <div className='max-w-md w-full flex items-center gap-2'>
            {/* <div className='max-w-sm w-full flex items-center gap-2 bg-stone-100 rounded-md px-2 shadow-inner border'> */}
            <Search className='w-4 h-4 text-stone-500' />
            <Input type="search" placeholder="Search for projects, people or commits..." className='w-full border-none bg-transparent ring-0 shadow-none !p-0 focus-visible:ring-0 focus-visible:ring-offset-0' />
        </div>
    )
}

export default SearchBar