import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { LogOut, SunMoon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEmbedding } from '@/components/embed-provider';
import { useTelemetry } from '@/components/telemetry-provider';
import { userHooks } from '@/hooks/user-hooks';
import { authenticationSession } from '@/lib/authentication-session';

import { Avatar, AvatarFallback } from './avatar';
import { AvatarLetter } from './avatar-letter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuItem,
} from './dropdown-menu';
import { TextWithIcon } from './text-with-icon';
import { CaretSortIcon } from '@radix-ui/react-icons';
export function UserAvatar() {
  const { reset } = useTelemetry();
  const { embedState } = useEmbedding();
  const { data: user } = userHooks.useCurrentUser();
  const queryClient = useQueryClient();
  if (!user || embedState.isEmbedded) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className='flex items-center gap-2 justify-between hover:bg-accent rounded-lg transition-colors cursor-pointer p-2'>
          <div className='flex items-center gap-2'>
          <Avatar className="cursor-pointer">
            <AvatarFallback>
              <AvatarLetter
                name={user.firstName + ' ' + user.lastName}
                email={user.email}
                disablePopup={true}
              ></AvatarLetter>
            </AvatarFallback>
          </Avatar>
          <div className='flex flex-col'> 
            <span className="text-sm  font-bold"> {user.firstName} {user.lastName}</span>
            <span className="w-[140px] text-xs text-muted-foreground truncate"> {user.email}</span>
          </div>
          </div>
          <CaretSortIcon className="ml-auto size-4 shrink-0 opacity-50" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <DropdownMenuLabel>
          <div className="flex">
            <div className="flex-grow flex-shrink truncate">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <Link to="/settings/appearance">
          <DropdownMenuItem className="cursor-pointer">
            <TextWithIcon
              icon={<SunMoon size={18} />}
              text={t('Appearance')}
              className="cursor-pointer"
            />
          </DropdownMenuItem>
        </Link>

        <DropdownMenuItem
          onClick={() => {
            userHooks.invalidateCurrentUser(queryClient);
            authenticationSession.logOut();
            reset();
          }}
          className="cursor-pointer"
        >
          <TextWithIcon
            icon={<LogOut size={18} className="text-destructive" />}
            text={<span className="text-destructive">{t('Logout')}</span>}
            className="cursor-pointer"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
