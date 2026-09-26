# Session Handling

1. When the user visits Friink’s public site with no valid session on that
   client, they stay on the public site.

2. If the client has one or more valid remembered sessions, Friink restores
   the most recently used one.

3. A session is restorable while its refresh token is valid and the session
   and account have not been ended. A temporary connection problem does not
   mean the session is invalid; Friink should offer retry.

4. Adding an account selects it across the client, including other open
   Friink tabs.

5. Switching accounts also changes the selection across the client. Other
   tabs may reload to show the selected account.

6. If a session was ended remotely, or its account was deactivated or
   scheduled for deletion, Friink explains what happened. When the user
   acknowledges the message, Friink restores another valid remembered session
   if one exists; otherwise, it takes them to the public site.

7. If a session cannot be restored for another reason, such as expiry or a
   security action, Friink explains that too. It should not silently switch
   accounts or treat a temporary outage as proof that the session ended.

8. Show the termination notice once per client, not once per tab. Other open
   tabs should wait for the user to acknowledge it, then all move to the same
   next valid session—or to the public site if none is available. If the tab
   showing the notice closes, another tab should be able to show it.
